'use client';

import { useEffect, useRef } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  className?: string;
  suffix?: string;
  duration?: number;
}

export default function AnimatedNumber({
  value,
  decimals = 0,
  className = '',
  suffix = '',
  duration = 0.8,
}: AnimatedNumberProps) {
  const spring = useSpring(value, {
    damping: 30,
    stiffness: 100,
    duration: duration * 1000,
  });

  const display = useTransform(spring, (current) =>
    current.toFixed(decimals)
  );

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return (
    <motion.span className={className}>
      <motion.span>{display}</motion.span>
      {suffix && <span>{suffix}</span>}
    </motion.span>
  );
}
