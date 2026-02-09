'use client';

import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import TimelineBackgroundGraph from './TimelineBackgroundGraph';
import TimelineDualGraph from './TimelineDualGraph';

interface TimelineData {
  id: number;
  name: string;
  activePower: number;
  windSpeed: number;
  timestamp: string;
}

interface TimelineProps {
  history: TimelineData[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  isLive: boolean;
  variant?: 'floating' | 'sidebar'; // sidebar = ใน DetailSidebar, floating = ลอยในฉาก 3D
}

// Mac Dock Effect - Magnification Calculator
function useDockEffect(
  mouseX: any,
  ref: React.RefObject<HTMLButtonElement | null>,
  baseSize: number = 60,
  magnification: number = 1.5
) {
  const distance = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    const centerX = bounds.x + bounds.width / 2;
    const distFromCenter = Math.abs(val - centerX);

    // Calculate scale based on distance (closer = larger)
    const maxDist = 200; // pixels
    const scale = Math.max(
      1,
      magnification - (distFromCenter / maxDist) * (magnification - 1)
    );
    return baseSize * scale;
  });

  const size = useSpring(distance, {
    damping: 20,
    stiffness: 300,
  });

  return size;
}

export default function Timeline({
  history,
  selectedIndex,
  onSelectIndex,
  isLive,
  variant = 'sidebar'
}: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(Infinity);

  // Auto-scroll to selected index
  useEffect(() => {
    if (scrollRef.current && selectedIndex >= 0) {
      const selectedElement = scrollRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedIndex]);

  if (history.length === 0) return null;

  const maxPower = Math.max(...history.map(d => d.activePower), 1);

  // Different styles for sidebar vs floating
  const isSidebar = variant === 'sidebar';
  const containerClass = isSidebar
    ? 'w-full bg-gradient-to-br from-blue-50 to-purple-50 rounded-3xl p-4 shadow-lg border border-gray-200'
    : 'w-full bg-white/10 backdrop-blur-sm rounded-3xl p-3 md:p-4 border border-white/20';

  // Calculate base dimensions for alignment
  const baseBarWidth = isSidebar ? 70 : 60;
  const barGap = 8; // gap-2 = 8px

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-bold ${isSidebar ? 'text-gray-800' : 'text-white drop-shadow-lg'}`}>
          📊 Timeline History
        </h3>
        {isLive && (
          <motion.span
            initial={{ scale: 0.9 }}
            animate={{ scale: [0.9, 1.05, 0.9] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
              isSidebar
                ? 'bg-green-500 text-white shadow-md'
                : 'bg-green-400 text-white'
            }`}
          >
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            LIVE
          </motion.span>
        )}
      </div>

      {/* Timeline Container - Centered with Dual-line Graph */}
      <div className="relative">
        {/* Background Faint Graph Layer */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-3xl">
          <TimelineBackgroundGraph
            history={history}
            width={Math.min(history.length * 90, 600)}
            height={140}
          />
        </div>

        {/* Dual-line Graph Above Timeline Bars */}
        <div className="flex justify-center">
          <div style={{ width: history.length * baseBarWidth + (history.length - 1) * barGap }}>
            <TimelineDualGraph
              history={history}
              barWidth={baseBarWidth}
              gap={barGap}
              selectedIndex={selectedIndex}
            />
          </div>
        </div>

        {/* Mac Dock Style Timeline - Centered & Scrollable */}
        <div className="flex justify-center">
          <div
            ref={scrollRef}
            onMouseMove={(e) => mouseX.set(e.pageX)}
            onMouseLeave={() => mouseX.set(Infinity)}
            className="flex gap-2 overflow-x-auto pb-3 pt-2 px-4 scrollbar-hide max-w-full"
            style={{
              scrollSnapType: 'x proximity',
              WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
            }}
          >
            {history.map((data, index) => (
              <TimelineBar
                key={data.id}
                data={data}
                index={index}
                isSelected={index === selectedIndex}
                onSelect={() => onSelectIndex(index)}
                maxPower={maxPower}
                mouseX={mouseX}
                isSidebar={isSidebar}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Instruction hint */}
      <div className="text-center mt-2">
        <p className={`text-[10px] ${isSidebar ? 'text-gray-500' : 'text-white/70'}`}>
          {isSidebar ? '← Scroll to explore past data →' : 'Hover/Tap to magnify'}
        </p>
      </div>
    </div>
  );
}

// Individual Timeline Bar with Dock Effect
function TimelineBar({
  data,
  isSelected,
  onSelect,
  maxPower,
  mouseX,
  isSidebar,
}: {
  data: TimelineData;
  index?: number;
  isSelected: boolean;
  onSelect: () => void;
  maxPower: number;
  mouseX: any;
  isSidebar: boolean;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const size = useDockEffect(mouseX, ref, isSidebar ? 70 : 60, 1.6);

  const heightPercent = (data.activePower / maxPower) * 100;
  const timestamp = new Date(data.timestamp);
  const timeStr = timestamp.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <motion.button
      ref={ref}
      onClick={onSelect}
      style={{
        width: size,
        scrollSnapAlign: 'center',
      }}
      whileTap={{ scale: 0.95 }}
      className="flex-shrink-0 flex flex-col items-center justify-end group"
    >
      {/* Bar Chart Container with iPhone-style rounded corners */}
      <motion.div
        className={`relative overflow-hidden mb-2 ${
          isSidebar ? 'rounded-[20px]' : 'rounded-[16px]'
        }`}
        style={{
          width: size,
          height: size,
          minHeight: isSidebar ? 70 : 60,
        }}
      >
        {/* Background with soft gradient */}
        <div className={`absolute inset-0 ${
          isSidebar
            ? 'bg-gradient-to-br from-gray-100 to-gray-200'
            : 'bg-white/20'
        }`} />

        {/* Power Bar with smooth gradient */}
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: `${heightPercent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`absolute bottom-0 left-0 right-0 ${
            isSelected
              ? isSidebar
                ? 'bg-gradient-to-t from-indigo-500 via-indigo-400 to-indigo-300'
                : 'bg-gradient-to-t from-yellow-500 via-yellow-400 to-yellow-300'
              : isSidebar
                ? 'bg-gradient-to-t from-blue-500 via-blue-400 to-blue-300'
                : 'bg-gradient-to-t from-blue-400 to-blue-300'
          }`}
          style={{
            boxShadow: isSelected
              ? '0 -4px 20px rgba(99, 102, 241, 0.5)'
              : '0 -2px 10px rgba(59, 130, 246, 0.3)',
          }}
        />

        {/* Value Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <motion.span
            style={{ fontSize: useTransform(size, [60, 100], [10, 14]) }}
            className={`font-black drop-shadow-lg ${
              isSidebar ? 'text-gray-800' : 'text-white'
            }`}
          >
            {data.activePower.toFixed(0)}
          </motion.span>
          <motion.span
            style={{ fontSize: useTransform(size, [60, 100], [8, 10]) }}
            className={`font-semibold ${
              isSidebar ? 'text-gray-600' : 'text-white/90'
            }`}
          >
            kW
          </motion.span>
        </div>

        {/* Selection Ring - iPhone style */}
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`absolute inset-0 border-4 ${
              isSidebar
                ? 'border-indigo-500 rounded-[20px]'
                : 'border-yellow-400 rounded-[16px]'
            }`}
            style={{
              boxShadow: isSidebar
                ? '0 0 20px rgba(99, 102, 241, 0.6)'
                : '0 0 20px rgba(251, 191, 36, 0.6)',
            }}
          />
        )}
      </motion.div>

      {/* Timestamp with smooth fade */}
      <motion.div
        style={{ fontSize: useTransform(size, [60, 100], [10, 12]) }}
        className={`font-semibold text-center ${
          isSidebar ? 'text-gray-700' : 'text-white/90'
        }`}
      >
        {timeStr}
      </motion.div>

      {/* Wind Speed */}
      <motion.div
        style={{ fontSize: useTransform(size, [60, 100], [8, 10]) }}
        className={`text-center mt-0.5 ${
          isSidebar ? 'text-gray-500' : 'text-white/70'
        }`}
      >
        {data.windSpeed.toFixed(1)} m/s
      </motion.div>
    </motion.button>
  );
}
