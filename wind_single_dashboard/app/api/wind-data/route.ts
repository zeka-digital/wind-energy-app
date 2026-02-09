import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface TurbineData {
  name: string;
  activePower: number;
  windSpeed: number;
  timestamp: string;
}

interface TurbineHistoryData extends TurbineData {
  id: number;
}

// CORS headers for ngrok and Vercel access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  try {
    // Fetch latest 5 measurements for each turbine
    const { data: measurements, error } = await supabase
      .from('wind_measurements')
      .select('id, timestamp, turbine_name, active_power, wind_speed')
      .order('timestamp', { ascending: false })
      .limit(100); // Get more data to ensure we have 5 per turbine

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch wind data', details: error.message },
        { status: 500, headers: corsHeaders }
      );
    }

    if (!measurements || measurements.length === 0) {
      return NextResponse.json(
        { error: 'No measurements found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Group measurements by turbine and get latest 5 for each
    const turbineHistoryMap = new Map<string, TurbineHistoryData[]>();

    for (const m of measurements) {
      const existing = turbineHistoryMap.get(m.turbine_name) || [];
      if (existing.length < 5) {
        existing.push({
          name: m.turbine_name,
          activePower: m.active_power,
          windSpeed: m.wind_speed,
          timestamp: m.timestamp,
          id: m.id,
        });
        turbineHistoryMap.set(m.turbine_name, existing);
      }
    }

    // Convert to array format with history
    const turbinesWithHistory = Array.from(turbineHistoryMap.entries())
      .map(([name, history]) => ({
        name,
        current: history[0], // Latest data
        history: history.slice().reverse(), // Oldest to newest for timeline
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      turbineCount: turbinesWithHistory.length,
      turbines: turbinesWithHistory,
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error fetching wind data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wind data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
