'use client';

import { Suspense, useEffect, useState } from 'react';
import Scene from './Scene';
import Link from 'next/link';
import DetailSidebar from './DetailSidebar';

interface TurbineData {
  name: string;
  activePower: number;
  windSpeed: number;
  timestamp: string;
}

interface WindDataResponse {
  file: string;
  turbineCount: number;
  turbines: TurbineData[];
}

export default function Dashboard3D() {
  const [windData, setWindData] = useState<WindDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTurbine, setSelectedTurbine] = useState<TurbineData | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);

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

  // Fetch wind data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/wind-data');
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
    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle turbine click
  const handleTurbineClick = (turbineName: string) => {
    const turbine = windData?.turbines.find(t => t.name === turbineName);
    if (turbine) {
      setSelectedTurbine(turbine);
      setIsSidebarOpen(true);
    }
  };

  // Handle sidebar close
  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
    setTimeout(() => setSelectedTurbine(null), 500); // Wait for animation to complete
  };

  // Calculate statistics
  const totalPower = windData?.turbines.reduce((sum, t) => sum + t.activePower, 0) || 0;
  const avgWindSpeed = (windData?.turbines.reduce((sum, t) => sum + t.windSpeed, 0) ?? 0) / (windData?.turbines.length || 1);

  // Calculate turbine count by power range for Legend
  const powerRanges = {
    low: windData?.turbines.filter(t => t.activePower <= 500).length || 0,
    medium: windData?.turbines.filter(t => t.activePower > 500 && t.activePower <= 1000).length || 0,
    high: windData?.turbines.filter(t => t.activePower > 1000 && t.activePower <= 2000).length || 0,
    peak: windData?.turbines.filter(t => t.activePower > 2000).length || 0
  };

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-blue-200 via-blue-100 to-green-100 overflow-hidden">
      {/* Detail Sidebar/Bottom Sheet */}
      {selectedTurbine && (
        <DetailSidebar
          turbine={selectedTurbine}
          onClose={handleCloseSidebar}
          isOpen={isSidebarOpen}
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

      {/* Info Panel - Hidden on Mobile, Shown on Desktop */}
      <div className="hidden md:block absolute bottom-6 left-6 z-[70] bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-xl max-w-xs">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Wind Farm Status</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Status:</span>
            <span className="text-green-600 font-semibold">
              {loading ? '⏳ Loading...' : error ? '⚠️ Error' : '● Operating'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Turbines:</span>
            <span className="text-gray-800 font-semibold">{windData?.turbineCount || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Avg Wind Speed:</span>
            <span className="text-gray-800 font-semibold">{avgWindSpeed.toFixed(1)} m/s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Power:</span>
            <span className="text-gray-800 font-semibold">{(totalPower / 1000).toFixed(2)} MW</span>
          </div>
          {windData && (
            <div className="flex justify-between text-xs pt-2 border-t border-gray-300">
              <span className="text-gray-500">Data from:</span>
              <span className="text-gray-600">{windData.file}</span>
            </div>
          )}
        </div>
      </div>

      {/* Power Color Legend - Desktop Full Panel (Hidden on Mobile) */}
      <div className="hidden md:block absolute top-24 right-6 z-[70] bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-xl min-w-[280px]">
        <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center justify-between">
          <span>⚡ Power Output Legend</span>
          <span className="text-sm text-gray-600 font-normal">({windData?.turbineCount || 0} total)</span>
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-lg shadow-md flex-shrink-0" style={{ backgroundColor: '#94a3b8' }}></div>
              <div className="flex flex-col">
                <span className="text-gray-700 font-medium">0-500 kW</span>
                <span className="text-gray-500 text-xs">Low Output</span>
              </div>
            </div>
            <span className="text-gray-800 font-bold text-lg">{powerRanges.low}</span>
          </div>
          <div className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-lg shadow-md flex-shrink-0" style={{ backgroundColor: '#fbbf24' }}></div>
              <div className="flex flex-col">
                <span className="text-gray-700 font-medium">501-1000 kW</span>
                <span className="text-gray-500 text-xs">Medium Output</span>
              </div>
            </div>
            <span className="text-gray-800 font-bold text-lg">{powerRanges.medium}</span>
          </div>
          <div className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-lg shadow-md flex-shrink-0" style={{ backgroundColor: '#4ade80' }}></div>
              <div className="flex flex-col">
                <span className="text-gray-700 font-medium">1001-2000 kW</span>
                <span className="text-gray-500 text-xs">High Output</span>
              </div>
            </div>
            <span className="text-gray-800 font-bold text-lg">{powerRanges.high}</span>
          </div>
          <div className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-lg shadow-md flex-shrink-0" style={{ backgroundColor: '#3b82f6' }}></div>
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
          {/* Modal */}
          <div className="md:hidden fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[120] bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-[90%] max-h-[80vh] overflow-y-auto">
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
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-8 h-8 rounded-lg shadow-md flex-shrink-0" style={{ backgroundColor: '#94a3b8' }}></div>
                  <div className="flex flex-col">
                    <span className="text-gray-700 font-medium">0-500 kW</span>
                    <span className="text-gray-500 text-xs">Low Output</span>
                  </div>
                </div>
                <span className="text-gray-800 font-bold text-lg">{powerRanges.low}</span>
              </div>
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-8 h-8 rounded-lg shadow-md flex-shrink-0" style={{ backgroundColor: '#fbbf24' }}></div>
                  <div className="flex flex-col">
                    <span className="text-gray-700 font-medium">501-1000 kW</span>
                    <span className="text-gray-500 text-xs">Medium Output</span>
                  </div>
                </div>
                <span className="text-gray-800 font-bold text-lg">{powerRanges.medium}</span>
              </div>
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-8 h-8 rounded-lg shadow-md flex-shrink-0" style={{ backgroundColor: '#4ade80' }}></div>
                  <div className="flex flex-col">
                    <span className="text-gray-700 font-medium">1001-2000 kW</span>
                    <span className="text-gray-500 text-xs">High Output</span>
                  </div>
                </div>
                <span className="text-gray-800 font-bold text-lg">{powerRanges.high}</span>
              </div>
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-8 h-8 rounded-lg shadow-md flex-shrink-0" style={{ backgroundColor: '#3b82f6' }}></div>
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

      {/* Controls Guide - Hidden on Mobile */}
      <div className="hidden md:block absolute bottom-6 right-6 z-[70] bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-xl max-w-xs">
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
        ) : windData && windData.turbines.length > 0 ? (
          <Suspense fallback={
            <div className="flex items-center justify-center w-full h-screen">
              <div className="text-white text-2xl">Loading 3D Scene...</div>
            </div>
          }>
            <Scene turbines={windData.turbines} onTurbineClick={handleTurbineClick} hideLabels={isSidebarOpen || isLegendOpen} />
          </Suspense>
        ) : (
          <div className="flex items-center justify-center w-full h-screen">
            <div className="text-white text-2xl">No turbine data available</div>
          </div>
        )}
      </div>

      {/* Bottom Bar - Scrollable Turbine Buttons (Responsive) */}
      {windData && windData.turbines.length > 0 && (
        <div
          className={`fixed bottom-0 right-0 z-[70] bg-gradient-to-t from-black/70 to-black/50 backdrop-blur-md border-t-2 border-white/20 transition-all duration-500 ease-in-out ${
            isSidebarOpen ? 'md:left-[40%] md:w-[60%] left-0 w-full' : 'left-0 w-full'
          }`}
        >
          <div className="p-2 md:p-4">
            <h3 className="text-xs md:text-sm font-bold text-white mb-2 md:mb-3 drop-shadow-lg">
              🎛️ Select Turbine ({windData.turbineCount}) - Scroll →
            </h3>
            {/* Horizontal Scrollable Row */}
            <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent">
              {windData.turbines.map((turbine) => {
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
                    className={`flex-shrink-0 px-3 py-2 md:px-4 md:py-3 rounded-lg border-2 transition-all duration-200 min-w-[120px] md:min-w-[140px] ${
                      isActive
                        ? 'shadow-lg shadow-white/50 scale-105 border-4'
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
