import { useRef, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import TerrainMesh from './TerrainMesh';
import GeoFeatures from './GeoFeatures';
import { TerrainData } from '@/lib/geotiff-loader';
import * as THREE from 'three';

interface TerrainViewerProps {
  terrain: TerrainData;
  exaggeration: number;
  waterLevel: number;
}

function CameraAnimator() {
  const { camera } = useThree();
  const progress = useRef(0);
  const done = useRef(false);

  const start = new THREE.Vector3(14, 12, 14);
  const end = new THREE.Vector3(0, 10, 12);
  const startTarget = new THREE.Vector3(0, 0, 0);
  const endTarget = new THREE.Vector3(0, 0, -1);

  useEffect(() => {
    camera.position.copy(start);
    camera.lookAt(startTarget);
  }, []);

  useFrame((_, delta) => {
    if (done.current) return;
    progress.current = Math.min(progress.current + delta * 0.15, 1);
    const t = 1 - Math.pow(1 - progress.current, 3); // ease-out cubic

    camera.position.lerpVectors(start, end, t);
    const target = new THREE.Vector3().lerpVectors(startTarget, endTarget, t);
    camera.lookAt(target);

    if (progress.current >= 1) done.current = true;
  });

  return null;
}

const TerrainViewer = ({ terrain, exaggeration, waterLevel }: TerrainViewerProps) => {
  return (
    <Canvas
      camera={{ position: [14, 12, 14], fov: 50, near: 0.1, far: 1000 }}
      className="w-full h-full"
      gl={{ antialias: true, toneMapping: 3 }}
    >
      <color attach="background" args={['#0d1117']} />
      <fog attach="fog" args={['#0d1117', 20, 50]} />
      
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-3, 5, -3]} intensity={0.4} color="#8ec8e8" />

      <TerrainMesh terrain={terrain} exaggeration={exaggeration} waterLevel={waterLevel} />
      <GeoFeatures terrain={terrain} exaggeration={exaggeration} />

      <CameraAnimator />

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2.1}
      />

      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport labelColor="white" axisHeadScale={0.8} />
      </GizmoHelper>

      <gridHelper args={[20, 20, '#1a2332', '#1a2332']} position={[0, -0.01, 0]} />
    </Canvas>
  );
};

export default TerrainViewer;
