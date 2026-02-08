'use client';

import { useEffect, useRef } from 'react';

interface TurbineData {
  name: string;
  activePower: number;
  windSpeed: number;
  timestamp: string;
}

interface DetailSidebarProps {
  turbine: TurbineData;
  onClose: () => void;
  isOpen: boolean;
}

// Function to get color palette based on Active Power (kW)
function getPowerColor(power: number): { base: string; light: string; dark: string } {
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
}

export default function DetailSidebar({ turbine, onClose, isOpen }: DetailSidebarProps) {
  const desktopCanvasRef = useRef<HTMLCanvasElement>(null);
  const mobileCanvasRef = useRef<HTMLCanvasElement>(null);

  // Animated 2D Wind Turbine using Canvas - Renders both Desktop and Mobile
  useEffect(() => {
    const canvases = [desktopCanvasRef.current, mobileCanvasRef.current].filter(Boolean);
    if (canvases.length === 0) return;

    const contexts = canvases.map(canvas => canvas!.getContext('2d')).filter(Boolean);
    if (contexts.length === 0) return;

    let rotation = 0;
    let animationId: number;

    // Calculate rotation speed based on wind speed
    const rotationSpeed = Math.min(0.02 + (turbine.windSpeed / 15) * 0.08, 0.1);

    // Get color palette based on active power
    const colors = getPowerColor(turbine.activePower);

    const drawTurbine = () => {
      // Draw on all available canvases (Desktop and Mobile)
      contexts.forEach((ctx, index) => {
        if (!ctx || !canvases[index]) return;

        const canvas = canvases[index];
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Draw tower with 3D cylindrical gradient (dark -> base -> light)
        const towerGradient = ctx.createLinearGradient(centerX - 10, 0, centerX + 10, 0);
        towerGradient.addColorStop(0, colors.dark);
        towerGradient.addColorStop(0.5, colors.base);
        towerGradient.addColorStop(1, colors.light);
        ctx.fillStyle = towerGradient;
        ctx.fillRect(centerX - 10, centerY + 20, 20, 100);

        // Draw nacelle with 3D box gradient
        const nacelleGradient = ctx.createLinearGradient(centerX - 20, 0, centerX + 20, 0);
        nacelleGradient.addColorStop(0, colors.dark);
        nacelleGradient.addColorStop(0.5, colors.base);
        nacelleGradient.addColorStop(1, colors.light);
        ctx.fillStyle = nacelleGradient;
        ctx.fillRect(centerX - 20, centerY, 40, 25);

        // Save context before rotation
        ctx.save();
        ctx.translate(centerX, centerY + 10);
        ctx.rotate(rotation);

        // Draw hub (center circle) with 3D spherical radial gradient
        const hubGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
        hubGradient.addColorStop(0, colors.light);
        hubGradient.addColorStop(0.6, colors.base);
        hubGradient.addColorStop(1, colors.dark);
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fillStyle = hubGradient;
        ctx.fill();

        // Draw 3 blades with airfoil gradient and shadows
        for (let i = 0; i < 3; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI * 2) / 3);

          // Add drop shadow for blade separation
          ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
          ctx.shadowBlur = 5;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;

          // Blade shape (tapered airfoil)
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(10, -40, 8, -70);
          ctx.quadraticCurveTo(0, -75, -8, -70);
          ctx.quadraticCurveTo(-10, -40, 0, 0);
          ctx.closePath();

          // Blade gradient for 3D airfoil effect (light -> base -> dark)
          const bladeGradient = ctx.createLinearGradient(-10, -40, 10, -40);
          bladeGradient.addColorStop(0, colors.light);
          bladeGradient.addColorStop(0.5, colors.base);
          bladeGradient.addColorStop(1, colors.dark);
          ctx.fillStyle = bladeGradient;
          ctx.fill();

          // Reset shadow for stroke
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;

          // Blade outline
          ctx.strokeStyle = colors.dark;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.restore();
        }

        // Draw hub center (on top) with inner radial gradient
        const hubCenterGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
        hubCenterGradient.addColorStop(0, colors.light);
        hubCenterGradient.addColorStop(0.5, colors.base);
        hubCenterGradient.addColorStop(1, colors.dark);
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fillStyle = hubCenterGradient;
        ctx.fill();
        ctx.strokeStyle = colors.dark;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
      });

      // Update rotation
      rotation += rotationSpeed;
      animationId = requestAnimationFrame(drawTurbine);
    };

    drawTurbine();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [turbine.windSpeed, turbine.activePower, turbine.name]);

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 bg-black/30 transition-opacity duration-300 z-[80] ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Desktop Sidebar (Left) - Hidden on Mobile */}
      <div
        className={`hidden md:block fixed left-0 top-0 h-full w-[40%] bg-white shadow-2xl z-[90] transform transition-transform duration-500 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full overflow-y-auto p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-gray-200">
            <h2 className="text-3xl font-bold text-gray-800">
              {turbine.name}
            </h2>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold shadow-md hover:shadow-lg"
            >
              ← Back
            </button>
          </div>

          {/* 2D Animated Turbine - Desktop (Always Visible) */}
          <div className="mb-8 bg-gradient-to-b from-blue-50 to-blue-100 rounded-xl p-6 shadow-inner">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
              Turbine Animation
            </h3>
            <div className="flex justify-center">
              <canvas
                ref={desktopCanvasRef}
                width={280}
                height={280}
                className="bg-white/60 rounded-lg shadow-md"
              />
            </div>
          </div>

          {/* Current Data */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">📊</span>
              Current Readings
            </h3>
            <div className="space-y-4">
              {/* Active Power */}
              <div className="bg-green-50 rounded-lg p-5 border-l-4 border-green-500 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium text-lg">
                    ⚡ Active Power
                  </span>
                  <span className="text-green-700 font-bold text-2xl">
                    {turbine.activePower.toFixed(1)} kW
                  </span>
                </div>
              </div>

              {/* Wind Speed */}
              <div className="bg-blue-50 rounded-lg p-5 border-l-4 border-blue-500 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium text-lg">
                    🌬️ Wind Speed
                  </span>
                  <span className="text-blue-700 font-bold text-2xl">
                    {turbine.windSpeed.toFixed(1)} m/s
                  </span>
                </div>
              </div>

              {/* Timestamp */}
              <div className="bg-purple-50 rounded-lg p-5 border-l-4 border-purple-500 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium text-lg">
                    🕐 Timestamp
                  </span>
                  <span className="text-purple-700 font-bold text-lg">
                    {new Date(turbine.timestamp).toLocaleString('th-TH', {
                      dateStyle: 'short',
                      timeStyle: 'medium'
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Future Placeholders */}
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">🔮</span>
              Additional Metrics (Coming Soon)
            </h3>
            <div className="space-y-4">
              {/* Placeholder 1 - Bearing Temperature */}
              <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-gray-300 shadow-sm opacity-60">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium text-lg">
                    🌡️ Bearing Temperature
                  </span>
                  <span className="text-gray-400 font-bold text-xl">
                    -- °C
                  </span>
                </div>
              </div>

              {/* Placeholder 2 - Pitch Angle */}
              <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-gray-300 shadow-sm opacity-60">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium text-lg">
                    🔄 Pitch Angle
                  </span>
                  <span className="text-gray-400 font-bold text-xl">
                    -- °
                  </span>
                </div>
              </div>

              {/* Placeholder 3 - Status */}
              <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-gray-300 shadow-sm opacity-60">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium text-lg">
                    🚦 Status
                  </span>
                  <span className="text-gray-400 font-bold text-xl">
                    --
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Info footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center italic">
              Click anywhere on the 3D view or press the Back button to close
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Sheet - Shown only on Mobile */}
      <div
        className={`md:hidden fixed left-0 right-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-[90] max-h-[85vh] transform transition-transform duration-500 ease-in-out flex flex-col ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Drag Handle - Fixed at Top */}
        <div className="flex-shrink-0 bg-white pt-4 pb-2 flex justify-center border-b border-gray-200 rounded-t-3xl">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </div>

        {/* Header - Fixed */}
        <div className="flex-shrink-0 bg-white px-6 pt-4 pb-3 border-b-2 border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">
              {turbine.name}
            </h2>
            <button
              onClick={onClose}
              className="flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold shadow-md"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-6">

            {/* 2D Animated Turbine - Mobile */}
            <div className="mb-6 bg-gradient-to-b from-blue-50 to-blue-100 rounded-xl p-4 shadow-inner">
              <h3 className="text-base font-semibold text-gray-700 mb-3 text-center">
                Turbine Animation
              </h3>
              <div className="flex justify-center">
                <canvas
                  ref={mobileCanvasRef}
                  width={200}
                  height={200}
                  className="bg-white/60 rounded-lg shadow-md"
                />
              </div>
            </div>

            {/* Current Data - Compact */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                <span className="mr-2">📊</span>
                Current Readings
              </h3>
              <div className="space-y-3">
                {/* Active Power */}
                <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500 shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium text-base">
                      ⚡ Active Power
                    </span>
                    <span className="text-green-700 font-bold text-xl">
                      {turbine.activePower.toFixed(1)} kW
                    </span>
                  </div>
                </div>

                {/* Wind Speed */}
                <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500 shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium text-base">
                      🌬️ Wind Speed
                    </span>
                    <span className="text-blue-700 font-bold text-xl">
                      {turbine.windSpeed.toFixed(1)} m/s
                    </span>
                  </div>
                </div>

                {/* Timestamp */}
                <div className="bg-purple-50 rounded-lg p-4 border-l-4 border-purple-500 shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium text-base">
                      🕐 Timestamp
                    </span>
                    <span className="text-purple-700 font-bold text-sm">
                      {new Date(turbine.timestamp).toLocaleString('th-TH', {
                        dateStyle: 'short',
                        timeStyle: 'medium'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Future Placeholders - Compact */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                <span className="mr-2">🔮</span>
                Additional Metrics
              </h3>
              <div className="space-y-2">
                {/* Placeholder 1 - Bearing Temperature */}
                <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-gray-300 shadow-sm opacity-60">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium text-sm">
                      🌡️ Bearing Temp
                    </span>
                    <span className="text-gray-400 font-bold text-base">
                      -- °C
                    </span>
                  </div>
                </div>

                {/* Placeholder 2 - Pitch Angle */}
                <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-gray-300 shadow-sm opacity-60">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium text-sm">
                      🔄 Pitch Angle
                    </span>
                    <span className="text-gray-400 font-bold text-base">
                      -- °
                    </span>
                  </div>
                </div>

                {/* Placeholder 3 - Status */}
                <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-gray-300 shadow-sm opacity-60">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium text-sm">
                      🚦 Status
                    </span>
                    <span className="text-gray-400 font-bold text-base">
                      --
                    </span>
                  </div>
                </div>
              </div>
            </div>

          {/* Info footer */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center italic">
              Tap outside to close
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
