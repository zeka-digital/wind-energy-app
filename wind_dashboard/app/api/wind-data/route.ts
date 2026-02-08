import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface TurbineData {
  name: string;
  activePower: number;
  windSpeed: number;
  timestamp: string;
}

// CORS headers for ngrok and Vercel access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  try {
    // Path to the CSV results directory
    const resultDir = path.join(process.cwd(), '..', 'enos_scraper', 'result');

    // Read all files in the directory
    const files = await fs.readdir(resultDir);

    // Filter only CSV files and sort by name (which includes date)
    const csvFiles = files
      .filter(file => file.endsWith('.csv'))
      .sort()
      .reverse(); // Get the latest file first

    if (csvFiles.length === 0) {
      return NextResponse.json({ error: 'No CSV files found' }, { status: 404, headers: corsHeaders });
    }

    // Read the latest CSV file
    const latestFile = csvFiles[0];
    const filePath = path.join(resultDir, latestFile);
    const fileContent = await fs.readFile(filePath, 'utf-8');

    // Parse CSV
    const lines = fileContent.trim().split('\n');

    // Process data - keep only the latest entry for each turbine
    const turbineMap = new Map<string, TurbineData>();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',');
      const timestamp = values[0];
      const turbineName = values[1];
      const activePowerStr = values[2];
      const windSpeedStr = values[3];

      // Parse numbers by removing units (kW and m/s)
      const activePower = parseFloat(activePowerStr.replace(' kW', '').trim());
      const windSpeed = parseFloat(windSpeedStr.replace(' m/s', '').trim());

      // Keep only the latest reading for each turbine
      if (!turbineMap.has(turbineName) || timestamp > turbineMap.get(turbineName)!.timestamp) {
        turbineMap.set(turbineName, {
          name: turbineName,
          activePower,
          windSpeed,
          timestamp
        });
      }
    }

    // Convert map to array and sort by turbine name
    const turbines = Array.from(turbineMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return NextResponse.json({
      file: latestFile,
      turbineCount: turbines.length,
      turbines
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error reading wind data:', error);
    return NextResponse.json(
      { error: 'Failed to read wind data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
