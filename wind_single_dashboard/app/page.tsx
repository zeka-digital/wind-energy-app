import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-blue-100 flex items-center justify-center p-4">
      <main className="max-w-4xl w-full">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-4">
              🏔️ Laos Mountain Wind Farm
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-2">
              Real-time Wind Energy Monitoring Dashboard
            </p>
            <p className="text-gray-500">
              Visualize and monitor wind turbine performance in 3D
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-blue-50 p-6 rounded-xl text-center">
              <div className="text-4xl mb-3">🌀</div>
              <h3 className="font-semibold text-gray-800 mb-2">3D Visualization</h3>
              <p className="text-sm text-gray-600">
                Interactive 3D view of all wind turbines in the mountain valley
              </p>
            </div>
            <div className="bg-green-50 p-6 rounded-xl text-center">
              <div className="text-4xl mb-3">⚡</div>
              <h3 className="font-semibold text-gray-800 mb-2">Real-time Data</h3>
              <p className="text-sm text-gray-600">
                Live power output and wind speed monitoring every 30 seconds
              </p>
            </div>
            <div className="bg-amber-50 p-6 rounded-xl text-center">
              <div className="text-4xl mb-3">📊</div>
              <h3 className="font-semibold text-gray-800 mb-2">Performance Metrics</h3>
              <p className="text-sm text-gray-600">
                Detailed statistics and power output analysis per turbine
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <div className="text-center">
            <Link
              href="/3d-dashboard"
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-green-600 text-white text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              <span>Launch Dashboard</span>
              <span className="text-2xl">→</span>
            </Link>
            <p className="text-sm text-gray-500 mt-4">
              Click to view the interactive 3D wind farm visualization
            </p>
          </div>

          {/* Footer Info */}
          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              Built with Next.js • React Three Fiber • Tailwind CSS
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
