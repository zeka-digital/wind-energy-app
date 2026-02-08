'use client';

interface MountainProps {
  position: [number, number, number];
  width?: number;
  height?: number;
  depth?: number;
}

export default function Mountain({ position, width = 20, height = 15, depth = 10 }: MountainProps) {
  return (
    <group position={position}>
      {/* Main mountain peak */}
      <mesh rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[width / 2, height, 8]} />
        <meshStandardMaterial
          color="#546e7a"
          roughness={0.9}
          flatShading
        />
      </mesh>

      {/* Side peaks for more natural look */}
      <mesh position={[-width * 0.3, -height * 0.2, depth * 0.2]} rotation={[0, Math.PI / 6, 0]}>
        <coneGeometry args={[width / 3, height * 0.7, 6]} />
        <meshStandardMaterial
          color="#607d8b"
          roughness={0.9}
          flatShading
        />
      </mesh>

      <mesh position={[width * 0.3, -height * 0.25, -depth * 0.1]} rotation={[0, -Math.PI / 5, 0]}>
        <coneGeometry args={[width / 3.5, height * 0.6, 6]} />
        <meshStandardMaterial
          color="#546e7a"
          roughness={0.9}
          flatShading
        />
      </mesh>
    </group>
  );
}
