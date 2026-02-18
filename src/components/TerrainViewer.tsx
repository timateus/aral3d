import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import TerrainMesh from './TerrainMesh';
import GeoFeatures from './GeoFeatures';
import { TerrainData } from '@/lib/geotiff-loader';

interface TerrainViewerProps {
  terrain: TerrainData;
  exaggeration: number;
}

const TerrainViewer = ({ terrain, exaggeration }: TerrainViewerProps) => {
  return (
    <Canvas
      camera={{ position: [8, 6, 8], fov: 50, near: 0.1, far: 1000 }}
      className="w-full h-full"
      gl={{ antialias: true, toneMapping: 3 }}
    >
      <color attach="background" args={['#0d1117']} />
      <fog attach="fog" args={['#0d1117', 20, 50]} />
      
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-3, 5, -3]} intensity={0.4} color="#8ec8e8" />

      <TerrainMesh terrain={terrain} exaggeration={exaggeration} />
      <GeoFeatures terrain={terrain} exaggeration={exaggeration} />

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
