'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface TimelineData {
  activePower: number;
  windSpeed: number;
}

interface TimelineDualGraphProps {
  history: TimelineData[];
  barWidth: number;
  gap: number;
  selectedIndex: number;
}

export default function TimelineDualGraph({
  history,
  barWidth,
  gap,
  selectedIndex,
}: TimelineDualGraphProps) {
  // Calculate SVG dimensions and paths
  const { width, height, powerPath, windPath, powerPoints, windPoints } = useMemo(() => {
    if (history.length === 0) return { width: 0, height: 0, powerPath: '', windPath: '', powerPoints: [], windPoints: [] };

    // Calculate total width based on bars
    const totalWidth = history.length * barWidth + (history.length - 1) * gap;
    const graphHeight = 80; // Height for the graph area
    const padding = 20;

    // Find max values for normalization
    const maxPower = Math.max(...history.map(d => d.activePower), 1);
    const maxWind = Math.max(...history.map(d => d.windSpeed), 1);

    // Calculate center X position for each bar
    const getCenterX = (index: number) => {
      return index * (barWidth + gap) + barWidth / 2;
    };

    // Calculate Y position for Active Power (inverted for SVG)
    const getPowerY = (power: number) => {
      return padding + (1 - power / maxPower) * (graphHeight - padding * 2);
    };

    // Calculate Y position for Wind Speed (inverted for SVG)
    const getWindY = (wind: number) => {
      return padding + (1 - wind / maxWind) * (graphHeight - padding * 2);
    };

    // Generate points for Active Power
    const powerPoints = history.map((data, index) => ({
      x: getCenterX(index),
      y: getPowerY(data.activePower),
      value: data.activePower,
    }));

    // Generate points for Wind Speed
    const windPoints = history.map((data, index) => ({
      x: getCenterX(index),
      y: getWindY(data.windSpeed),
      value: data.windSpeed,
    }));

    // Create SVG path for Active Power line
    const powerPath = powerPoints.length > 0
      ? `M ${powerPoints.map(p => `${p.x},${p.y}`).join(' L ')}`
      : '';

    // Create SVG path for Wind Speed line
    const windPath = windPoints.length > 0
      ? `M ${windPoints.map(p => `${p.x},${p.y}`).join(' L ')}`
      : '';

    return {
      width: totalWidth,
      height: graphHeight,
      powerPath,
      windPath,
      powerPoints,
      windPoints,
    };
  }, [history, barWidth, gap]);

  if (history.length === 0) return null;

  return (
    <div className="relative w-full flex justify-center mb-3">
      <svg
        width={width}
        height={height}
        className="overflow-visible"
        style={{
          filter: 'blur(0.5px)',
        }}
      >
        <defs>
          {/* Gradient for Active Power */}
          <linearGradient id="powerLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>

          {/* Gradient for Wind Speed */}
          <linearGradient id="windLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>

          {/* Glow effect */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Active Power Line */}
        <motion.path
          d={powerPath}
          stroke="url(#powerLineGradient)"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.35}
          filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.35 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        />

        {/* Wind Speed Line */}
        <motion.path
          d={windPath}
          stroke="url(#windLineGradient)"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.35}
          filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.35 }}
          transition={{ duration: 1.2, ease: 'easeInOut', delay: 0.1 }}
        />

        {/* Active Power Data Points */}
        {powerPoints.map((point, index) => {
          const isSelected = index === selectedIndex;
          return (
            <motion.g key={`power-point-${index}`}>
              {/* Glow ring for selected point */}
              {isSelected && (
                <motion.circle
                  cx={point.x}
                  cy={point.y}
                  r="8"
                  fill="none"
                  stroke="#0ea5e9"
                  strokeWidth="2"
                  opacity={0.4}
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}

              {/* Data point */}
              <motion.circle
                cx={point.x}
                cy={point.y}
                r={isSelected ? "4.5" : "3.5"}
                fill="#0ea5e9"
                opacity={isSelected ? 0.8 : 0.5}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: 0.8 + index * 0.08 }}
              />
            </motion.g>
          );
        })}

        {/* Wind Speed Data Points */}
        {windPoints.map((point, index) => {
          const isSelected = index === selectedIndex;
          return (
            <motion.g key={`wind-point-${index}`}>
              {/* Glow ring for selected point */}
              {isSelected && (
                <motion.circle
                  cx={point.x}
                  cy={point.y}
                  r="8"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  opacity={0.4}
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.1 }}
                />
              )}

              {/* Data point */}
              <motion.circle
                cx={point.x}
                cy={point.y}
                r={isSelected ? "4.5" : "3.5"}
                fill="#10b981"
                opacity={isSelected ? 0.8 : 0.5}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: 0.9 + index * 0.08 }}
              />
            </motion.g>
          );
        })}

        {/* Grid lines (subtle) */}
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={`grid-${i}`}
            x1="0"
            y1={20 + (i * (height - 40) / 4)}
            x2={width}
            y2={20 + (i * (height - 40) / 4)}
            stroke="#e5e7eb"
            strokeWidth="0.5"
            opacity="0.15"
            strokeDasharray="4 4"
          />
        ))}

        {/* Legend */}
        <g transform={`translate(${width - 150}, 10)`}>
          {/* Active Power legend */}
          <line
            x1="0"
            y1="5"
            x2="20"
            y2="5"
            stroke="url(#powerLineGradient)"
            strokeWidth="2.5"
            opacity="0.5"
          />
          <circle cx="10" cy="5" r="3" fill="#0ea5e9" opacity="0.6" />
          <text x="25" y="9" fontSize="10" fill="#64748b" fontWeight="500">
            Active Power
          </text>

          {/* Wind Speed legend */}
          <line
            x1="0"
            y1="20"
            x2="20"
            y2="20"
            stroke="url(#windLineGradient)"
            strokeWidth="2.5"
            opacity="0.5"
          />
          <circle cx="10" cy="20" r="3" fill="#10b981" opacity="0.6" />
          <text x="25" y="24" fontSize="10" fill="#64748b" fontWeight="500">
            Wind Speed
          </text>
        </g>
      </svg>
    </div>
  );
}
