'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface TimelineData {
  activePower: number;
  windSpeed: number;
}

interface TimelineBackgroundGraphProps {
  history: TimelineData[];
  width: number;
  height: number;
}

export default function TimelineBackgroundGraph({
  history,
  width,
  height,
}: TimelineBackgroundGraphProps) {
  // Calculate SVG paths for Active Power and Wind Speed
  const { powerPath, windPath, powerAreaPath, windAreaPath } = useMemo(() => {
    if (history.length === 0) return { powerPath: '', windPath: '', powerAreaPath: '', windAreaPath: '' };

    const maxPower = Math.max(...history.map(d => d.activePower), 1);
    const maxWind = Math.max(...history.map(d => d.windSpeed), 1);
    const padding = 10;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    // Calculate points for Active Power
    const powerPoints = history.map((data, index) => {
      const x = padding + (index / (history.length - 1)) * graphWidth;
      const y = padding + (1 - data.activePower / maxPower) * graphHeight;
      return { x, y };
    });

    // Calculate points for Wind Speed
    const windPoints = history.map((data, index) => {
      const x = padding + (index / (history.length - 1)) * graphWidth;
      const y = padding + (1 - data.windSpeed / maxWind) * graphHeight;
      return { x, y };
    });

    // Create SVG path for Active Power line
    const powerPath = powerPoints.length > 0
      ? `M ${powerPoints.map(p => `${p.x},${p.y}`).join(' L ')}`
      : '';

    // Create SVG path for Wind Speed line
    const windPath = windPoints.length > 0
      ? `M ${windPoints.map(p => `${p.x},${p.y}`).join(' L ')}`
      : '';

    // Create SVG path for Active Power area (filled)
    const powerAreaPath = powerPoints.length > 0
      ? `M ${padding},${height - padding} L ${powerPoints.map(p => `${p.x},${p.y}`).join(' L ')} L ${width - padding},${height - padding} Z`
      : '';

    // Create SVG path for Wind Speed area (filled)
    const windAreaPath = windPoints.length > 0
      ? `M ${padding},${height - padding} L ${windPoints.map(p => `${p.x},${p.y}`).join(' L ')} L ${width - padding},${height - padding} Z`
      : '';

    return { powerPath, windPath, powerAreaPath, windAreaPath };
  }, [history, width, height]);

  if (history.length === 0) return null;

  return (
    <svg
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
      style={{
        filter: 'blur(1.5px)',
        opacity: 0.12,
      }}
    >
      <defs>
        {/* Gradient for Active Power */}
        <linearGradient id="powerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
        </linearGradient>

        {/* Gradient for Wind Speed */}
        <linearGradient id="windGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Active Power Area (filled) */}
      <motion.path
        d={powerAreaPath}
        fill="url(#powerGradient)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />

      {/* Wind Speed Area (filled) */}
      <motion.path
        d={windAreaPath}
        fill="url(#windGradient)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.1 }}
      />

      {/* Active Power Line */}
      <motion.path
        d={powerPath}
        stroke="#3b82f6"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeInOut' }}
      />

      {/* Wind Speed Line */}
      <motion.path
        d={windPath}
        stroke="#10b981"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeInOut', delay: 0.1 }}
      />

      {/* Data points for Active Power */}
      {history.map((data, index) => {
        const maxPower = Math.max(...history.map(d => d.activePower), 1);
        const padding = 10;
        const graphWidth = width - padding * 2;
        const graphHeight = height - padding * 2;
        const x = padding + (index / (history.length - 1)) * graphWidth;
        const y = padding + (1 - data.activePower / maxPower) * graphHeight;

        return (
          <motion.circle
            key={`power-${index}`}
            cx={x}
            cy={y}
            r="2.5"
            fill="#3b82f6"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, delay: 0.8 + index * 0.05 }}
          />
        );
      })}

      {/* Data points for Wind Speed */}
      {history.map((data, index) => {
        const maxWind = Math.max(...history.map(d => d.windSpeed), 1);
        const padding = 10;
        const graphWidth = width - padding * 2;
        const graphHeight = height - padding * 2;
        const x = padding + (index / (history.length - 1)) * graphWidth;
        const y = padding + (1 - data.windSpeed / maxWind) * graphHeight;

        return (
          <motion.circle
            key={`wind-${index}`}
            cx={x}
            cy={y}
            r="2"
            fill="#10b981"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, delay: 0.9 + index * 0.05 }}
          />
        );
      })}
    </svg>
  );
}
