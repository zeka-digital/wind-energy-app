'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import Scene from './Scene';
import Link from 'next/link';
import DetailSidebar from './DetailSidebar';
import Timeline from './Timeline';
import AnimatedNumber from './AnimatedNumber';
import { supabase } from '@/lib/supabase';

interface TurbineData {
  name: string;
  activePower: number;
  windSpeed: number;
  timestamp: string;
}

interface TurbineHistoryData extends TurbineData {
  id: number;
}

interface TurbineWithHistory {
  name: string;
  current: TurbineHistoryData;
  history: TurbineHistoryData[];
}

interface WindDataResponse {
  turbineCount: number;
  turbines: TurbineWithHistory[];
}

export default function Dashboard3D() {
  const [windData, setWindData] = useState<WindDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTurbineName, setSelectedTurbineName] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  // Timeline & Real-time states
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number>(-1); // -1 = live mode
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [displayData, setDisplayData] = useState<TurbineData[]>([]);
  const [liveUpdateFlash, setLiveUpdateFlash] = useState(false); // Visual feedback for live updates
  const [newDataAvailable, setNewDataAvailable] = useState(false); // Notification for History Mode
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('disconnected'); // Realtime connection status
  const [retryCount, setRetryCount] = useState(0); // Retry counter
  const [retryTimeout, setRetryTimeout] = useState<NodeJS.Timeout | null>(null); // Retry timeout reference

  // Lock 2 (Status Guard): Prevent overlapping connections
  const isConnecting = useRef(false); // Guard to prevent multiple simultaneous connection attempts

  // Get selected turbine from displayData (reactive to timeline changes)
  const selectedTurbine = selectedTurbineName
    ? displayData.find(t => t.name === selectedTurbineName) || null
    : null;

  // Function to get color palette based on Active Power (kW)
  const getPowerColors = (power: number): { base: string; light: string; dark: string } => {
    if (power <= 500) {
      return {
        base: '#94a3b8',   // Slate Blue
        light: '#cbd5e1',  // Lighter slate
        dark: '#64748b'    // Darker slate
      };
    }
    if (power <= 1000) {
      return {
        base: '#fbbf24',   // Amber
        light: '#fde68a',  // Lighter amber
        dark: '#f59e0b'    // Darker amber
      };
    }
    if (power <= 2000) {
      return {
        base: '#4ade80',   // Light Green
        light: '#86efac',  // Lighter green
        dark: '#22c55e'    // Darker green
      };
    }
    return {
      base: '#3b82f6',   // Blue
      light: '#60a5fa',  // Lighter blue
      dark: '#2563eb'    // Darker blue
    };
  };

  // Function to get base color (for backward compatibility)
  const getPowerColor = (power: number): string => {
    return getPowerColors(power).base;
  };

  // Function to get text color based on background color
  const getTextColor = (bgColor: string): string => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1f2937' : '#ffffff';
  };

  // Update display data based on selected history index
  useEffect(() => {
    if (!windData) return;

    if (isLiveMode || selectedHistoryIndex === -1) {
      // Show current (live) data
      const currentData = windData.turbines.map(t => ({
        name: t.name,
        activePower: t.current.activePower,
        windSpeed: t.current.windSpeed,
        timestamp: t.current.timestamp,
      }));
      setDisplayData(currentData);
    } else {
      // Show historical data at selected index
      const historicalData = windData.turbines.map(t => {
        const historyItem = t.history[selectedHistoryIndex] || t.current;
        return {
          name: t.name,
          activePower: historyItem.activePower,
          windSpeed: historyItem.windSpeed,
          timestamp: historyItem.timestamp,
        };
      });
      setDisplayData(historicalData);
    }
  }, [windData, selectedHistoryIndex, isLiveMode]);

  // Handle timeline selection
  const handleTimelineSelect = useCallback((index: number) => {
    setSelectedHistoryIndex(index);
    setIsLiveMode(false);
  }, []);

  // Handle back to live
  const handleBackToLive = useCallback(() => {
    setSelectedHistoryIndex(-1);
    setIsLiveMode(true);
    setNewDataAvailable(false); // Clear notification badge
  }, []);

  // Fetch wind data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/wind-data', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        if (!response.ok) {
          throw new Error('Failed to fetch wind data');
        }
        const data = await response.json();
        setWindData(data);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Real-time Subscription to wind_measurements (Optimistic Updates with Retry Logic)
  useEffect(() => {
    if (!windData) {
      console.log('⏳ Realtime: Waiting for initial data...');
      return;
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isSubscribed = false;
    let connectionTimeout: NodeJS.Timeout | null = null;

    const MAX_RETRIES = 5; // จำนวนครั้งที่จะ Retry
    const RETRY_DELAY = 10000; // Lock 3: รอ 10 วินาทีก่อน Retry (เพิ่มจาก 5)

    const connectToRealtime = async () => {
      try {
        // Lock 2 (Status Guard): Prevent overlapping connections
        if (isConnecting.current) {
          console.log('⚠️ [LOCK 2] Already connecting, skipping duplicate connection attempt');
          return;
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔌 [TRIPLE-LOCK] Realtime: Initializing subscription...');
        console.log(`📊 Retry count: ${retryCount}/${MAX_RETRIES}`);
        console.log('🔑 Checking credentials...');

        // Set connecting flag
        isConnecting.current = true;
        console.log('🔒 [LOCK 2] isConnecting set to TRUE');

        // Debug: Check if credentials are available
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
          console.error('❌ Missing Supabase credentials!');
          console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Found' : '❌ Missing');
          console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✅ Found' : '❌ Missing');
          setRealtimeStatus('disconnected');
          isConnecting.current = false;
          console.log('🔓 [LOCK 2] isConnecting set to FALSE (credentials missing)');
          return;
        }

        console.log('✅ URL:', supabaseUrl);
        console.log('✅ Key:', supabaseKey.substring(0, 20) + '...');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Lock 1 (Cleanup First): Remove ALL channels and wait for completion
        console.log('🧹 [LOCK 1] Starting COMPLETE cleanup...');

        // Step 1: Unsubscribe existing channel properly
        if (channel) {
          console.log('🧹 [LOCK 1] Unsubscribing existing channel...');
          console.log('🌐 [SOCKET] Old channel status:', channel.state);
          try {
            await channel.unsubscribe();
            console.log('✅ [LOCK 1] Channel unsubscribed successfully');
          } catch (e) {
            console.warn('⚠️ [LOCK 1] Error unsubscribing channel:', e);
          }
          channel = null;
        }

        // Step 2: Remove ALL channels from Supabase client
        console.log('🧹 [LOCK 1] Removing ALL channels from Supabase client...');
        try {
          await supabase.removeAllChannels();
          console.log('✅ [LOCK 1] All channels removed successfully');
        } catch (e) {
          console.warn('⚠️ [LOCK 1] Error removing all channels:', e);
        }

        // Step 3: Wait for cleanup to complete
        console.log('⏳ [LOCK 1] Waiting 1 second for cleanup to complete...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('✅ [LOCK 1] Cleanup completed, ready to create new connection');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Set status based on retry count
        console.log('🌐 [SOCKET] Setting status to:', retryCount === 0 ? 'connecting' : 'reconnecting');
        if (retryCount === 0) {
          setRealtimeStatus('connecting');
        } else {
          setRealtimeStatus('reconnecting');
        }

        // Clear any existing timeout
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
        }

        // Set timeout for connection (20 seconds)
        connectionTimeout = setTimeout(() => {
          if (!isSubscribed) {
            console.log('⏱️ [TIMEOUT] Connection timeout after 20 seconds');
            console.log('🌐 [SOCKET] Socket did not establish connection in time');
            handleConnectionError('TIMEOUT');
          }
        }, 20000);

        console.log('🌐 [SOCKET] Creating new channel: wind_measurements_realtime_channel');
        channel = supabase
          .channel('wind_measurements_realtime_channel', {
            config: {
              broadcast: { self: false },
              presence: { key: '' },
            },
          })
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'wind_measurements',
            },
            (payload) => {
              // Log IMMEDIATELY when payload arrives (before any processing)
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.log('📡 [RECEIVED] Payload arrived at:', new Date().toISOString());
              console.log('📦 Full Payload:', JSON.stringify(payload, null, 2));
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

              try {
                console.log('🔴 REAL-TIME MESSAGE RECEIVED!');
                console.log('📊 New Data:', payload.new);
                console.log('🏷️ Turbine Name:', (payload.new as any).turbine_name);
                console.log('⚡ Active Power:', (payload.new as any).active_power, 'kW');
                console.log('🌬️ Wind Speed:', (payload.new as any).wind_speed, 'm/s');
                console.log('⏰ Timestamp:', (payload.new as any).timestamp);

                const newMeasurement = payload.new as any;

                // Extract data from payload
                const turbineName = newMeasurement.turbine_name;
                const newData: TurbineHistoryData = {
                  id: newMeasurement.id,
                  name: turbineName,
                  activePower: newMeasurement.active_power,
                  windSpeed: newMeasurement.wind_speed,
                  timestamp: newMeasurement.timestamp,
                };

                console.log('━━━ [STATE UPDATE] Starting state update ━━━');
                console.log('🔄 Target turbine:', turbineName);
                console.log('🔄 New power:', newData.activePower, 'kW');
                console.log('🔄 New wind:', newData.windSpeed, 'm/s');

                // Optimistic update: Update windData immediately
                setWindData((prevData) => {
                  console.log('━━━ [SETWINDDATA] Inside setWindData callback ━━━');

                  if (!prevData) {
                    console.error('❌ [CRITICAL] Previous data is null! This should not happen!');
                    console.error('❌ Returning prevData without update');
                    return prevData;
                  }

                  console.log('✅ [SETWINDDATA] Previous data exists');
                  console.log('📝 Previous turbines count:', prevData.turbines.length);
                  console.log('📝 Looking for turbine:', turbineName);

                  let turbineFound = false;

                  // Find the turbine and update it
                  const updatedTurbines = prevData.turbines.map((turbine) => {
                    if (turbine.name === turbineName) {
                      turbineFound = true;
                      console.log(`✅ [MATCH] Found matching turbine: ${turbineName}`);
                      console.log(`📊 Old power: ${turbine.current.activePower} kW → New: ${newData.activePower} kW`);
                      console.log(`🌬️ Old wind: ${turbine.current.windSpeed} m/s → New: ${newData.windSpeed} m/s`);

                      // Add new data to history (at the end)
                      const updatedHistory = [...turbine.history, newData];

                      // Keep only last 5 records
                      const trimmedHistory = updatedHistory.slice(-5);

                      console.log(`📊 History updated: ${turbine.history.length} → ${trimmedHistory.length} records`);

                      return {
                        ...turbine,
                        current: newData, // Update current to latest
                        history: trimmedHistory,
                      };
                    }
                    return turbine;
                  });

                  if (!turbineFound) {
                    console.error(`❌ [ERROR] Turbine "${turbineName}" NOT FOUND in data!`);
                    console.error('Available turbines:', prevData.turbines.map(t => t.name).join(', '));
                  }

                  const newState = {
                    ...prevData,
                    turbines: updatedTurbines,
                  };

                  console.log('✅ [SETWINDDATA] Returning new state');
                  console.log('━━━ [STATE UPDATE] State update completed ━━━');
                  return newState;
                });

                // Visual feedback for live updates
                // Always flash the update (regardless of mode)
                console.log('✨ Triggering visual flash effect...');
                setLiveUpdateFlash(true);
                setTimeout(() => setLiveUpdateFlash(false), 1000);

                // Set notification badge (will only show in history mode due to UI logic)
                setNewDataAvailable(true);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
              } catch (error) {
                console.error('❌ Error processing realtime message:', error);
                // Don't crash - just log the error
              }
            }
          )
          .subscribe((status) => {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🌐 Socket Status:', status);
            console.log('📡 [SUBSCRIPTION STATUS]:', status);
            console.log('⏰ Time:', new Date().toISOString());
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            if (status === 'SUBSCRIBED') {
              console.log('🌐 Socket Status: SUBSCRIBED ✅');
              isSubscribed = true;
              if (connectionTimeout) {
                clearTimeout(connectionTimeout);
              }
              console.log('✅ ═══════════════════════════════════════');
              console.log('✅ REALTIME SUCCESSFULLY CONNECTED!');
              console.log('✅ ═══════════════════════════════════════');
              console.log('📋 Channel: wind_measurements_realtime_channel');
              console.log('🗄️ Schema: public');
              console.log('📊 Table: wind_measurements');
              console.log('🎯 Event: INSERT');
              console.log('🔍 Status: Listening for new data from Scraper...');
              console.log('🌐 Socket is now OPEN and ready to receive messages');
              console.log('✅ ═══════════════════════════════════════');
              setRealtimeStatus('connected');
              setRetryCount(0); // Reset retry count on successful connection
              // Lock 2: Release connecting flag
              isConnecting.current = false;
              console.log('🔓 [LOCK 2] isConnecting set to FALSE (connected successfully)');
            } else if (status === 'CHANNEL_ERROR') {
              console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.error('🌐 Socket Status: CHANNEL_ERROR ❌');
              console.error('❌ [ERROR] Realtime channel error');
              console.error('💡 WebSocket encountered an error');
              console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              // Lock 2: Release connecting flag before retry
              isConnecting.current = false;
              console.log('🔓 [LOCK 2] isConnecting set to FALSE (error occurred)');
              handleConnectionError('CHANNEL_ERROR');
            } else if (status === 'TIMED_OUT') {
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.log('🌐 Socket Status: TIMED_OUT ⏱️');
              console.log('🔄 [TIMEOUT] Realtime connection timed out');
              console.log('💡 WebSocket did not connect in time');
              console.log('🔄 [LOCK 3] Will retry in 10 seconds...');
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              // Lock 2: Release connecting flag before retry
              isConnecting.current = false;
              console.log('🔓 [LOCK 2] isConnecting set to FALSE (timed out)');
              handleConnectionError('TIMED_OUT');
            } else if (status === 'CLOSED') {
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.log('🌐 Socket Status: CLOSED 🔌');
              console.log('🔌 [CLOSED] Realtime connection closed');
              console.log('💡 WebSocket connection was terminated');
              if (isSubscribed) {
                console.log('🔄 [RETRY] Connection was active before');
                console.log('🔄 [LOCK 3] Will retry in 10 seconds...');
                // Lock 2: Release connecting flag before retry
                isConnecting.current = false;
                console.log('🔓 [LOCK 2] isConnecting set to FALSE (closed)');
                // Only retry if we were previously subscribed
                handleConnectionError('CLOSED');
              } else {
                console.log('⏭️ [SKIP] Connection never established, skipping retry');
                // Lock 2: Release connecting flag
                isConnecting.current = false;
                console.log('🔓 [LOCK 2] isConnecting set to FALSE (never established)');
              }
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            } else {
              // Log any other status changes
              console.log('🌐 Socket Status:', status, '(intermediate state)');
            }
          });
      } catch (error) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ [SETUP_ERROR] Error setting up realtime subscription:', error);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        // Lock 2: Release connecting flag on error
        isConnecting.current = false;
        console.log('🔓 [LOCK 2] isConnecting set to FALSE (setup error)');
        handleConnectionError('SETUP_ERROR');
      }
    };

    const handleConnectionError = (errorType: string) => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🌐 [SOCKET ERROR] Type:', errorType);
      console.log(`🔄 Connection error: ${errorType}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      if (retryCount < MAX_RETRIES) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🌐 [SOCKET RETRY] Scheduling retry...');
        console.log(`🔄 [LOCK 3] Will retry in ${RETRY_DELAY / 1000} seconds... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
        console.log('⏰ [LOCK 3] Next retry at:', new Date(Date.now() + RETRY_DELAY).toISOString());
        console.log('🧹 [LOCK 3] Old state will be cleaned before retry');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        setRealtimeStatus('reconnecting');

        const timeout = setTimeout(() => {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('🌐 [SOCKET RETRY] Retry triggered!');
          console.log('🔄 Incrementing retry count...');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          setRetryCount((prev) => prev + 1);
        }, RETRY_DELAY);

        setRetryTimeout(timeout);
      } else {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🌐 [SOCKET] Max retries reached');
        console.log('❌ Max retries reached. Realtime connection unavailable.');
        console.log('💡 Please check your network connection and Supabase settings');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        setRealtimeStatus('disconnected');
        setRetryCount(0); // Reset for next attempt
      }
    };

    // Start connection
    connectToRealtime();

    // Cleanup function
    return () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🧹 [CLEANUP] Starting cleanup...');
      console.log('🧹 [CLEANUP] Reason: Component remounting or dependency change');
      console.log('⏰ Cleanup time:', new Date().toISOString());
      isSubscribed = false;

      if (connectionTimeout) {
        console.log('🧹 [CLEANUP] Clearing connection timeout');
        clearTimeout(connectionTimeout);
      }

      if (retryTimeout) {
        console.log('🧹 [CLEANUP] Clearing retry timeout');
        clearTimeout(retryTimeout);
      }

      if (channel) {
        console.log('🧹 [CLEANUP] Removing channel subscription');
        console.log('🌐 [SOCKET] Channel state before removal:', channel.state);
        try {
          supabase.removeChannel(channel);
          console.log('✅ [CLEANUP] Channel removed successfully');
          console.log('🌐 [SOCKET] WebSocket connection closed');
        } catch (e) {
          console.error('❌ [CLEANUP] Error removing channel:', e);
        }
      } else {
        console.log('⏭️ [CLEANUP] No channel to remove');
      }

      console.log('✅ [CLEANUP] Realtime subscription cleaned up');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    };
  }, [windData, retryCount]); // Removed isLiveMode to prevent unnecessary reconnections

  // Handle turbine click
  const handleTurbineClick = useCallback((turbineName: string) => {
    setSelectedTurbineName(turbineName);
    setIsSidebarOpen(true);
  }, []);

  // Handle sidebar close
  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
    setTimeout(() => setSelectedTurbineName(null), 500); // Wait for animation to complete
  }, []);

  // Calculate statistics using displayData
  const totalPower = displayData.reduce((sum, t) => sum + t.activePower, 0);
  const avgWindSpeed = displayData.length > 0
    ? displayData.reduce((sum, t) => sum + t.windSpeed, 0) / displayData.length
    : 0;

  // Calculate turbine count by power range for Legend
  const powerRanges = {
    low: displayData.filter(t => t.activePower <= 500).length,
    medium: displayData.filter(t => t.activePower > 500 && t.activePower <= 1000).length,
    high: displayData.filter(t => t.activePower > 1000 && t.activePower <= 2000).length,
    peak: displayData.filter(t => t.activePower > 2000).length,
  };

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-blue-200 via-blue-100 to-green-100 overflow-hidden">
      {/* Detail Sidebar/Bottom Sheet with Timeline */}
      {selectedTurbine && windData && (
        <DetailSidebar
          turbine={selectedTurbine}
          onClose={handleCloseSidebar}
          isOpen={isSidebarOpen}
          history={windData.turbines.find(t => t.name === selectedTurbine.name)?.history || []}
          selectedHistoryIndex={selectedHistoryIndex}
          onSelectHistoryIndex={handleTimelineSelect}
          isLive={isLiveMode}
        />
      )}

      {/* Main 3D Content - Responsive width based on sidebar state */}
      <div
        className={`relative h-screen transition-all duration-500 ease-in-out ${
          isSidebarOpen ? 'md:ml-[40%] md:w-[60%] ml-0 w-full' : 'ml-0 w-full'
        }`}
      >
        {/* Header - Desktop Version */}
        <div className="hidden md:block absolute top-0 left-0 right-0 z-[100] p-6 bg-gradient-to-b from-black/40 to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white drop-shadow-lg">
                🏔️ Laos Mountain Wind Farm
              </h1>
              <p className="text-white/90 text-sm mt-1 drop-shadow">
                Morning mist over the highlands
              </p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-sm transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>

        {/* Mobile Header - Back Button (Top Left) - Always Visible */}
        <Link
          href="/"
          className="md:hidden fixed top-4 left-4 z-[100] w-10 h-10 bg-white/90 hover:bg-white backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center text-gray-800 transition-colors"
        >
          <span className="text-xl font-bold">←</span>
        </Link>

        {/* Mobile Title - Center (Optional) */}
        <div className="md:hidden fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full">
          <h1 className="text-sm font-bold text-white whitespace-nowrap">
            🏔️ Wind Farm
          </h1>
        </div>

      {/* Info Panel - Hidden on Mobile, Shown on Desktop - iPhone Style */}
      <div className="hidden md:block absolute bottom-6 left-6 z-[70] bg-white/95 backdrop-blur-md rounded-[24px] p-5 shadow-2xl max-w-xs border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Wind Farm Status</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Status:</span>
            <span className="flex items-center gap-1">
              {loading ? (
                <span className="text-gray-600 font-semibold">⏳ Loading...</span>
              ) : error ? (
                <span className="text-red-600 font-semibold">⚠️ Error</span>
              ) : isLiveMode ? (
                <>
                  <motion.span
                    className="w-2 h-2 bg-green-500 rounded-full"
                    animate={{
                      scale: liveUpdateFlash ? [1, 1.5, 1] : 1,
                      opacity: liveUpdateFlash ? [1, 0.5, 1] : 1,
                    }}
                    transition={{ duration: 0.5 }}
                  />
                  <motion.span
                    className="text-green-600 font-semibold"
                    animate={{
                      scale: liveUpdateFlash ? [1, 1.1, 1] : 1,
                    }}
                    transition={{ duration: 0.5 }}
                  >
                    LIVE
                  </motion.span>
                </>
              ) : (
                <span className="text-blue-600 font-semibold">📜 History</span>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Realtime:</span>
            <span className="flex items-center gap-1.5">
              {realtimeStatus === 'connected' ? (
                <>
                  <motion.span
                    className="w-2 h-2 bg-green-500 rounded-full"
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [1, 0.5, 1],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="text-green-600 font-semibold text-xs">Connected</span>
                </>
              ) : realtimeStatus === 'connecting' ? (
                <>
                  <motion.span
                    className="w-2 h-2 bg-yellow-500 rounded-full"
                    animate={{
                      scale: [1, 1.2, 1],
                    }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                  <span className="text-yellow-600 font-semibold text-xs">Connecting...</span>
                </>
              ) : realtimeStatus === 'reconnecting' ? (
                <>
                  <motion.span
                    className="w-2 h-2 bg-orange-500 rounded-full"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [1, 0.6, 1],
                    }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                  />
                  <span className="text-orange-600 font-semibold text-xs">Reconnecting...</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 bg-gray-400 rounded-full" />
                  <span className="text-gray-500 font-semibold text-xs">Disconnected</span>
                </>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Turbines:</span>
            <span className="text-gray-800 font-semibold">{windData?.turbineCount || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Avg Wind Speed:</span>
            <span className="text-gray-800 font-semibold">
              <AnimatedNumber value={avgWindSpeed} decimals={1} suffix=" m/s" />
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Power:</span>
            <span className="text-gray-800 font-semibold">
              <AnimatedNumber value={totalPower / 1000} decimals={2} suffix=" MW" />
            </span>
          </div>
          {!isLiveMode && (
            <button
              onClick={handleBackToLive}
              className="relative w-full mt-3 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-[16px] hover:from-green-600 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center gap-2"
            >
              {newDataAvailable && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg"
                >
                  NEW
                </motion.span>
              )}
              <span className="text-xl">▶</span>
              <span>Back to LIVE</span>
            </button>
          )}
        </div>
      </div>

      {/* Power Color Legend - Desktop Full Panel (Hidden on Mobile) - iPhone Style */}
      <div className="hidden md:block absolute top-24 right-6 z-[70] bg-white/95 backdrop-blur-md rounded-[24px] p-5 shadow-2xl min-w-[280px] border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center justify-between">
          <span>⚡ Power Output Legend</span>
          <span className="text-sm text-gray-600 font-normal">({windData?.turbineCount || 0} total)</span>
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3 p-2 rounded-[16px] hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-[12px] shadow-md flex-shrink-0" style={{ backgroundColor: '#94a3b8' }}></div>
              <div className="flex flex-col">
                <span className="text-gray-700 font-medium">0-500 kW</span>
                <span className="text-gray-500 text-xs">Low Output</span>
              </div>
            </div>
            <span className="text-gray-800 font-bold text-lg">{powerRanges.low}</span>
          </div>
          <div className="flex items-center justify-between gap-3 p-2 rounded-[16px] hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-[12px] shadow-md flex-shrink-0" style={{ backgroundColor: '#fbbf24' }}></div>
              <div className="flex flex-col">
                <span className="text-gray-700 font-medium">501-1000 kW</span>
                <span className="text-gray-500 text-xs">Medium Output</span>
              </div>
            </div>
            <span className="text-gray-800 font-bold text-lg">{powerRanges.medium}</span>
          </div>
          <div className="flex items-center justify-between gap-3 p-2 rounded-[16px] hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-[12px] shadow-md flex-shrink-0" style={{ backgroundColor: '#4ade80' }}></div>
              <div className="flex flex-col">
                <span className="text-gray-700 font-medium">1001-2000 kW</span>
                <span className="text-gray-500 text-xs">High Output</span>
              </div>
            </div>
            <span className="text-gray-800 font-bold text-lg">{powerRanges.high}</span>
          </div>
          <div className="flex items-center justify-between gap-3 p-2 rounded-[16px] hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-[12px] shadow-md flex-shrink-0" style={{ backgroundColor: '#3b82f6' }}></div>
              <div className="flex flex-col">
                <span className="text-gray-700 font-medium">2001-4000 kW</span>
                <span className="text-gray-500 text-xs">Peak Output</span>
              </div>
            </div>
            <span className="text-gray-800 font-bold text-lg">{powerRanges.peak}</span>
          </div>
        </div>
      </div>

      {/* Mobile Legend Button (Info Icon) - Top Right - Always Visible */}
      <button
        onClick={() => setIsLegendOpen(true)}
        className="md:hidden fixed top-4 right-4 z-[100] w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center text-blue-600 hover:bg-white transition-colors"
      >
        <span className="text-2xl font-bold">ℹ️</span>
      </button>

      {/* Mobile Legend Modal */}
      {isLegendOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsLegendOpen(false)}
            className="md:hidden fixed inset-0 bg-black/50 z-[110] animate-fade-in"
          />
          {/* Modal - iPhone Style */}
          <div className="md:hidden fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[120] bg-white rounded-[28px] p-6 shadow-2xl max-w-sm w-[90%] max-h-[80vh] overflow-y-auto border border-gray-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">
                ⚡ Power Legend
              </h2>
              <button
                onClick={() => setIsLegendOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3 p-3 rounded-[18px] bg-gray-50">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-8 h-8 rounded-[12px] shadow-md flex-shrink-0" style={{ backgroundColor: '#94a3b8' }}></div>
                  <div className="flex flex-col">
                    <span className="text-gray-700 font-medium">0-500 kW</span>
                    <span className="text-gray-500 text-xs">Low Output</span>
                  </div>
                </div>
                <span className="text-gray-800 font-bold text-lg">{powerRanges.low}</span>
              </div>
              <div className="flex items-center justify-between gap-3 p-3 rounded-[18px] bg-gray-50">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-8 h-8 rounded-[12px] shadow-md flex-shrink-0" style={{ backgroundColor: '#fbbf24' }}></div>
                  <div className="flex flex-col">
                    <span className="text-gray-700 font-medium">501-1000 kW</span>
                    <span className="text-gray-500 text-xs">Medium Output</span>
                  </div>
                </div>
                <span className="text-gray-800 font-bold text-lg">{powerRanges.medium}</span>
              </div>
              <div className="flex items-center justify-between gap-3 p-3 rounded-[18px] bg-gray-50">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-8 h-8 rounded-[12px] shadow-md flex-shrink-0" style={{ backgroundColor: '#4ade80' }}></div>
                  <div className="flex flex-col">
                    <span className="text-gray-700 font-medium">1001-2000 kW</span>
                    <span className="text-gray-500 text-xs">High Output</span>
                  </div>
                </div>
                <span className="text-gray-800 font-bold text-lg">{powerRanges.high}</span>
              </div>
              <div className="flex items-center justify-between gap-3 p-3 rounded-[18px] bg-gray-50">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-8 h-8 rounded-[12px] shadow-md flex-shrink-0" style={{ backgroundColor: '#3b82f6' }}></div>
                  <div className="flex flex-col">
                    <span className="text-gray-700 font-medium">2001-4000 kW</span>
                    <span className="text-gray-500 text-xs">Peak Output</span>
                  </div>
                </div>
                <span className="text-gray-800 font-bold text-lg">{powerRanges.peak}</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-200 text-center text-xs text-gray-500">
              Total: {windData?.turbineCount || 0} turbines
            </div>
          </div>
        </>
      )}

      {/* Controls Guide - Hidden on Mobile - iPhone Style */}
      <div className="hidden md:block absolute bottom-6 right-6 z-[70] bg-white/95 backdrop-blur-md rounded-[24px] p-5 shadow-2xl max-w-xs border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">🎮 Controls</h2>
        <div className="space-y-1 text-sm text-gray-700">
          <div>🖱️ <strong>Left Click + Drag:</strong> Rotate view</div>
          <div>🖱️ <strong>Right Click + Drag:</strong> Pan view</div>
          <div>🔄 <strong>Scroll:</strong> Zoom in/out</div>
          <div>🎯 <strong>Click Turbine Button:</strong> Show details</div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-300 text-xs text-gray-600">
          ✅ All {windData?.turbineCount || 0} turbines with 3D labels displayed
        </div>
      </div>

        {/* 3D Scene */}
        {loading ? (
          <div className="flex items-center justify-center w-full h-screen">
            <div className="text-white text-2xl">Loading wind data...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center w-full h-screen">
            <div className="text-red-500 text-2xl">Error: {error}</div>
          </div>
        ) : displayData.length > 0 ? (
          <Suspense fallback={
            <div className="flex items-center justify-center w-full h-screen">
              <div className="text-white text-2xl">Loading 3D Scene...</div>
            </div>
          }>
            <Scene turbines={displayData} onTurbineClick={handleTurbineClick} hideLabels={isSidebarOpen || isLegendOpen} />
          </Suspense>
        ) : (
          <div className="flex items-center justify-center w-full h-screen">
            <div className="text-white text-2xl">No turbine data available</div>
          </div>
        )}

      </div>

      {/* Bottom Bar - Scrollable Turbine Buttons (Responsive) */}
      {displayData.length > 0 && (
        <div
          className={`fixed bottom-0 right-0 z-[70] bg-gradient-to-t from-black/70 to-black/50 backdrop-blur-md border-t-2 border-white/20 transition-all duration-500 ease-in-out ${
            isSidebarOpen ? 'md:left-[40%] md:w-[60%] left-0 w-full' : 'left-0 w-full'
          }`}
        >
          <div className="p-2 md:p-4">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <h3 className="text-xs md:text-sm font-bold text-white drop-shadow-lg">
                🎛️ Select Turbine ({displayData.length}) - Scroll →
              </h3>
              {/* Live/History Indicator - iPhone Style with Notification */}
              {isLiveMode ? (
                <motion.span
                  className="flex items-center gap-1.5 text-xs text-white font-bold px-3 py-1.5 bg-green-500 rounded-full shadow-lg"
                  animate={{
                    scale: liveUpdateFlash ? [1, 1.1, 1] : 1,
                  }}
                  transition={{ duration: 0.5 }}
                >
                  <motion.span
                    className="w-2 h-2 bg-white rounded-full"
                    animate={{
                      scale: liveUpdateFlash ? [1, 1.5, 1] : [1, 1.2, 1],
                    }}
                    transition={{
                      duration: liveUpdateFlash ? 0.5 : 1.5,
                      repeat: liveUpdateFlash ? 0 : Infinity,
                    }}
                  />
                  LIVE
                </motion.span>
              ) : (
                <button
                  onClick={handleBackToLive}
                  className="relative px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-xs font-bold rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-1"
                >
                  {newDataAvailable && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.2, 1], rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 0.5 }}
                      className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-md"
                    >
                      •
                    </motion.span>
                  )}
                  <span>▶</span>
                  <span>LIVE</span>
                </button>
              )}
            </div>
            {/* Horizontal Scrollable Row */}
            <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent">
              {displayData.map((turbine) => {
                const isActive = selectedTurbine?.name === turbine.name;
                const bgColor = getPowerColor(turbine.activePower);
                const textColor = getTextColor(bgColor);
                return (
                  <button
                    key={turbine.name}
                    onClick={() => handleTurbineClick(turbine.name)}
                    style={{
                      backgroundColor: bgColor,
                      borderColor: isActive ? '#ffffff' : bgColor,
                      color: textColor
                    }}
                    className={`flex-shrink-0 px-3 py-2 md:px-4 md:py-3 rounded-[20px] border-2 transition-all duration-300 min-w-[120px] md:min-w-[140px] ${
                      isActive
                        ? 'shadow-xl shadow-white/50 scale-105 border-4'
                        : 'hover:scale-105 hover:shadow-lg'
                    }`}
                  >
                    <div className="font-bold text-xs md:text-sm" style={{ color: textColor }}>
                      {turbine.name}
                    </div>
                    <div className="text-[10px] md:text-xs font-semibold opacity-90" style={{ color: textColor }}>
                      ⚡ {turbine.activePower.toFixed(0)} kW
                    </div>
                    <div className="text-[10px] md:text-xs font-medium opacity-85" style={{ color: textColor }}>
                      🌬️ {turbine.windSpeed.toFixed(1)} m/s
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
