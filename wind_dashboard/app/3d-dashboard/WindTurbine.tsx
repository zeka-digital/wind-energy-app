'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface WindTurbineProps {
  position: [number, number, number];
  windSpeed: number;
  activePower: number;
  turbineName: string;
  showLabel?: boolean;
  onLabelClick?: (turbineName: string) => void;
}

// Function to get color palette based on Active Power (kW)
function getPowerColors(power: number): { base: string; light: string; dark: string } {
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

// Function to get base color (for backward compatibility)
function getPowerColor(power: number): string {
  return getPowerColors(power).base;
}

// Function to get text color based on background color (for readability)
function getTextColor(bgColor: string): string {
  // Convert hex to RGB
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate luminance using standard formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark backgrounds, black for light backgrounds
  return luminance > 0.5 ? '#1f2937' : '#ffffff';
}

export default function WindTurbine({
  position,
  windSpeed,
  activePower,
  turbineName,
  showLabel = false,
  onLabelClick
}: WindTurbineProps) {
  const bladesRef = useRef<THREE.Group>(null);

  // Calculate rotation speed based on wind speed (normalize between 0.01 to 0.08)
  const rotationSpeed = Math.min(0.01 + (windSpeed / 15) * 0.07, 0.08);

  // Get color based on active power
  const powerColor = getPowerColor(activePower);
  const textColor = getTextColor(powerColor);

  // Animate the blades rotation based on wind speed
  // Rotate around X-axis (forward-facing direction from nacelle)
  useFrame(() => {
    if (bladesRef.current) {
      bladesRef.current.rotation.x += rotationSpeed;
    }
  });

  // Calculate rotation to face camera at initial position [-35, 28, 55]
  // All turbines face the same direction (towards the camera) for optimal viewing
  const facingRotation = Math.atan2(55, -35); // ≈ 2.133 radians (122°)

  return (
    <group position={position} rotation={[0, facingRotation, 0]}>
      {/* Concrete Base Platform */}
      <mesh position={[0, -3.1, 0]}>
        <cylinderGeometry args={[0.8, 1, 0.3, 16]} />
        <meshStandardMaterial color="#9e9e9e" roughness={0.8} />
      </mesh>

      {/* Base Ring */}
      <mesh position={[0, -3, 0]}>
        <cylinderGeometry args={[0.5, 0.6, 0.2, 16]} />
        <meshStandardMaterial color="#757575" metalness={0.3} roughness={0.7} />
      </mesh>

      {/* Tower (เสาหลัก) - Color based on Active Power */}
      <mesh position={[0, -1.5, 0]}>
        <cylinderGeometry args={[0.18, 0.24, 3, 16]} />
        <meshStandardMaterial color={powerColor} metalness={0.3} roughness={0.7} />
      </mesh>

      {/* Nacelle (ตัวเครื่องกำเนิดไฟฟ้า) - Color based on Active Power */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.6, 0.4, 0.4]} />
        <meshStandardMaterial color={powerColor} metalness={0.3} roughness={0.7} />
      </mesh>

      {/* Hub (ฮับกลาง) - Matte white, positioned to connect with blades */}
      <mesh position={[0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.22, 0.15, 16]} />
        <meshStandardMaterial color="#f5f5f5" metalness={0.02} roughness={0.92} />
      </mesh>

      {/* Blades Group (กลุ่มใบพัด) - Color based on Active Power */}
      <group ref={bladesRef} position={[0.38, 0, 0]}>
        {/* Blade 1 - Upward, with pitch angle */}
        <mesh position={[0, 0.8, 0]} rotation={[0, Math.PI / 2, Math.PI * 0.04]}>
          <boxGeometry args={[0.08, 1.6, 0.26]} />
          <meshStandardMaterial color={powerColor} metalness={0.3} roughness={0.7} />
        </mesh>

        {/* Blade 2 - 120 degrees rotation, with pitch angle */}
        <mesh position={[0, -0.4, 0.7]} rotation={[0, Math.PI / 2, (Math.PI * 2) / 3 + Math.PI * 0.04]}>
          <boxGeometry args={[0.08, 1.6, 0.26]} />
          <meshStandardMaterial color={powerColor} metalness={0.3} roughness={0.7} />
        </mesh>

        {/* Blade 3 - 240 degrees rotation, with pitch angle */}
        <mesh position={[0, -0.4, -0.7]} rotation={[0, Math.PI / 2, (Math.PI * 4) / 3 + Math.PI * 0.04]}>
          <boxGeometry args={[0.08, 1.6, 0.26]} />
          <meshStandardMaterial color={powerColor} metalness={0.3} roughness={0.7} />
        </mesh>
      </group>

      {/* Modern Billboard Label - Optimized for all turbines - Now Clickable! */}
      {showLabel && (
        <Html
          position={[0, 1.2, 0]}
          center
          distanceFactor={12}
          occlude
          style={{
            pointerEvents: 'auto',
            transform: 'translate3d(0,0,0)',
            willChange: 'transform'
          }}
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              onLabelClick?.(turbineName);
            }}
            style={{
              background: powerColor,
              backdropFilter: 'blur(8px)',
              borderRadius: '10px',
              padding: '10px 14px',
              minWidth: '130px',
              boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
              fontFamily: 'system-ui, sans-serif',
              transform: 'translate3d(0,0,0)',
              cursor: 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease, background 0.3s ease',
              color: textColor
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translate3d(0,0,0) scale(1.08)';
              e.currentTarget.style.boxShadow = '0 10px 40px rgba(0,0,0,0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translate3d(0,0,0) scale(1)';
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.25)';
            }}
          >
            <div style={{
              fontSize: '13px',
              fontWeight: '700',
              color: textColor,
              marginBottom: '6px',
              textAlign: 'center',
              letterSpacing: '0.3px'
            }}>
              {turbineName}
            </div>
            <div style={{
              fontSize: '11px',
              color: textColor,
              fontWeight: '700',
              marginBottom: '2px',
              textAlign: 'center',
              opacity: 0.95
            }}>
              ⚡ {activePower.toFixed(1)} kW
            </div>
            <div style={{
              fontSize: '11px',
              color: textColor,
              fontWeight: '600',
              textAlign: 'center',
              opacity: 0.9
            }}>
              🌬️ {windSpeed.toFixed(1)} m/s
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
