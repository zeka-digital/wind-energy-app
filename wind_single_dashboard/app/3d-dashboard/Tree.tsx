'use client';

interface TreeProps {
  position: [number, number, number];
  scale?: number;
}

export default function Tree({ position, scale = 1 }: TreeProps) {
  return (
    <group position={position} scale={scale}>
      {/* Tree trunk */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.1 * scale, 0.15 * scale, 1 * scale, 8]} />
        <meshStandardMaterial color="#5d4037" roughness={0.9} />
      </mesh>

      {/* Tree foliage - 3 layers */}
      <mesh position={[0, 1.3, 0]}>
        <coneGeometry args={[0.6 * scale, 1 * scale, 8]} />
        <meshStandardMaterial color="#2e7d32" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.7, 0]}>
        <coneGeometry args={[0.5 * scale, 0.8 * scale, 8]} />
        <meshStandardMaterial color="#388e3c" roughness={0.8} />
      </mesh>
      <mesh position={[0, 2, 0]}>
        <coneGeometry args={[0.4 * scale, 0.6 * scale, 8]} />
        <meshStandardMaterial color="#43a047" roughness={0.8} />
      </mesh>
    </group>
  );
}
