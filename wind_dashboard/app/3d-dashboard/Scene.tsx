'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import WindTurbine from './WindTurbine';
import Tree from './Tree';
import Mountain from './Mountain';
import * as THREE from 'three';
import { useRef, useMemo } from 'react';

interface TurbineData {
  name: string;
  activePower: number;
  windSpeed: number;
  timestamp: string;
}

interface SceneProps {
  turbines: TurbineData[];
  onTurbineClick?: (turbineName: string) => void;
  hideLabels?: boolean;
}

export default function Scene({ turbines, onTurbineClick, hideLabels = false }: SceneProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  // Calculate grid layout (10 turbines per row) with wider spacing
  const turbinesPerRow = 10;
  const spacing = 9; // Increased from 5 to 9 for better visibility

  const getTurbinePosition = (index: number): [number, number, number] => {
    const row = Math.floor(index / turbinesPerRow);
    const col = index % turbinesPerRow;
    const x = (col - turbinesPerRow / 2 + 0.5) * spacing;
    const z = row * spacing;
    // Add slight height variation for terrain effect
    const y = Math.sin(x * 0.08) * 0.4 + Math.cos(z * 0.12) * 0.3;
    return [x, y, z];
  };

  // Generate random tree positions (reduced count for performance)
  const trees = useMemo(() => {
    const treeList: Array<{ pos: [number, number, number]; scale: number }> = [];
    for (let i = 0; i < 60; i++) {
      const x = (Math.random() - 0.5) * 180;
      const z = (Math.random() - 0.5) * 180;
      // Avoid placing trees too close to turbines
      const tooClose = turbines.some((_, idx) => {
        const tPos = getTurbinePosition(idx);
        const dist = Math.sqrt((x - tPos[0]) ** 2 + (z - tPos[2]) ** 2);
        return dist < 3;
      });
      if (!tooClose) {
        const y = Math.sin(x * 0.08) * 0.4 + Math.cos(z * 0.12) * 0.3 - 3.2;
        treeList.push({
          pos: [x, y, z],
          scale: 0.7 + Math.random() * 0.7
        });
      }
    }
    return treeList;
    // Trees should be generated once on mount, not regenerated when turbines change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle pan constraints to keep camera within project bounds
  const handleControlsChange = () => {
    if (controlsRef.current) {
      const target = controlsRef.current.target;
      // Constrain X axis (horizontal) - keep within forest and mountain area
      target.x = Math.max(-80, Math.min(80, target.x));
      // Constrain Z axis (depth) - prevent panning too far forward or backward
      target.z = Math.max(-30, Math.min(120, target.z));
      // Constrain Y axis (height) - prevent going underground or too high
      target.y = Math.max(-2, Math.min(40, target.y));
    }
  };

  return (
    <div className="w-full h-screen">
      <Canvas>
        {/* Camera positioned to focus on WA101 (first turbine) with mountain backdrop */}
        <PerspectiveCamera makeDefault position={[-42, 22, 30]} />
        <OrbitControls
          ref={controlsRef}
          target={[-40, 3, 0]}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          enableDamping={false}
          panSpeed={1.5}
          minDistance={20}
          maxDistance={400}
          minPolarAngle={Math.PI / 12}
          maxPolarAngle={Math.PI / 2.1}
          onChange={handleControlsChange}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
          }}
        />

        {/* Soft Morning Lighting */}
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[40, 30, 25]}
          intensity={1.0}
          color="#fffaec"
          castShadow
        />
        <hemisphereLight args={['#b3d9ff', '#4a7c59', 0.65]} />
        <fog attach="fog" args={['#c8dae8', 150, 500]} />

        {/* Infinite Ground - 10x larger to create seamless horizon */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.3, 0]} receiveShadow>
          <planeGeometry args={[2200, 2200, 80, 80]} />
          <meshStandardMaterial
            color="#4a7c59"
            roughness={0.95}
            metalness={0.05}
          />
        </mesh>

        {/* Mountain Enclosure - Surrounding on 3 sides (Left, Right, Back) */}

        {/* BACK - Far background mountain wall */}
        <Mountain position={[-120, -3, -150]} width={60} height={55} depth={35} />
        <Mountain position={[-80, -3, -140]} width={55} height={50} depth={32} />
        <Mountain position={[-40, -3, -145]} width={58} height={52} depth={34} />
        <Mountain position={[0, -3, -150]} width={62} height={58} depth={36} />
        <Mountain position={[40, -3, -145]} width={56} height={53} depth={33} />
        <Mountain position={[80, -3, -142]} width={60} height={55} depth={35} />
        <Mountain position={[120, -3, -148]} width={58} height={54} depth={34} />

        {/* BACK - Mid-distance mountains */}
        <Mountain position={[-100, -3, -100]} width={48} height={42} depth={28} />
        <Mountain position={[-60, -3, -105]} width={50} height={45} depth={30} />
        <Mountain position={[-20, -3, -108]} width={46} height={40} depth={27} />
        <Mountain position={[20, -3, -110]} width={52} height={46} depth={31} />
        <Mountain position={[60, -3, -106]} width={48} height={43} depth={29} />
        <Mountain position={[100, -3, -102]} width={50} height={44} depth={30} />

        {/* LEFT WALL - Mountain range on left side */}
        <Mountain position={[-180, -3, -120]} width={55} height={48} depth={32} />
        <Mountain position={[-170, -3, -80]} width={52} height={46} depth={30} />
        <Mountain position={[-165, -3, -40]} width={50} height={44} depth={28} />
        <Mountain position={[-160, -3, 0]} width={48} height={42} depth={27} />
        <Mountain position={[-155, -3, 40]} width={46} height={40} depth={26} />
        <Mountain position={[-150, -3, 80]} width={44} height={38} depth={25} />
        <Mountain position={[-145, -3, 120]} width={42} height={36} depth={24} />

        {/* LEFT WALL - Inner layer */}
        <Mountain position={[-130, -3, -100]} width={42} height={36} depth={24} />
        <Mountain position={[-125, -3, -60]} width={40} height={35} depth={23} />
        <Mountain position={[-120, -3, -20]} width={38} height={34} depth={22} />
        <Mountain position={[-115, -3, 20]} width={36} height={32} depth={21} />
        <Mountain position={[-110, -3, 60]} width={35} height={31} depth={20} />
        <Mountain position={[-105, -3, 100]} width={34} height={30} depth={19} />

        {/* RIGHT WALL - Mountain range on right side */}
        <Mountain position={[180, -3, -120]} width={55} height={48} depth={32} />
        <Mountain position={[170, -3, -80]} width={52} height={46} depth={30} />
        <Mountain position={[165, -3, -40]} width={50} height={44} depth={28} />
        <Mountain position={[160, -3, 0]} width={48} height={42} depth={27} />
        <Mountain position={[155, -3, 40]} width={46} height={40} depth={26} />
        <Mountain position={[150, -3, 80]} width={44} height={38} depth={25} />
        <Mountain position={[145, -3, 120]} width={42} height={36} depth={24} />

        {/* RIGHT WALL - Inner layer */}
        <Mountain position={[130, -3, -100]} width={42} height={36} depth={24} />
        <Mountain position={[125, -3, -60]} width={40} height={35} depth={23} />
        <Mountain position={[120, -3, -20]} width={38} height={34} depth={22} />
        <Mountain position={[115, -3, 20]} width={36} height={32} depth={21} />
        <Mountain position={[110, -3, 60]} width={35} height={31} depth={20} />
        <Mountain position={[105, -3, 100]} width={34} height={30} depth={19} />

        {/* Trees scattered around */}
        {trees.map((tree, idx) => (
          <Tree key={idx} position={tree.pos} scale={tree.scale} />
        ))}

        {/* Render ALL turbines - Hide labels when detail or legend is open */}
        {turbines.map((turbine, index) => (
          <WindTurbine
            key={turbine.name}
            position={getTurbinePosition(index)}
            windSpeed={turbine.windSpeed}
            activePower={turbine.activePower}
            turbineName={turbine.name}
            showLabel={!hideLabels}
            onLabelClick={onTurbineClick}
          />
        ))}
      </Canvas>
    </div>
  );
}
