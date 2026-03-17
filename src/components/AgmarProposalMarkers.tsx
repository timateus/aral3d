import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import { AGMAR_PROPOSAL_SITES } from '@/lib/agmar-tour-steps';
import { TerrainData } from '@/lib/geotiff-loader';
import * as THREE from 'three';

interface AgmarProposalMarkersProps {
  terrain: TerrainData;
  exaggeration: number;
}

function geoToMeshPos(
  lon: number, lat: number,
  terrain: TerrainData, exaggeration: number
): [number, number, number] {
  const { bounds, width, height, elevations } = terrain;
  const u = (lon - bounds.west) / (bounds.east - bounds.west);
  const v = (lat - bounds.south) / (bounds.north - bounds.south);
  const col = Math.round(u * (width - 1));
  const row = Math.round((1 - v) * (height - 1));
  const idx = row * width + col;
  const elev = elevations[idx] ?? 0;
  const meshX = (u - 0.5) * 10;
  const meshZ = (0.5 - v) * 10;
  const meshY = (elev / (terrain.maxElevation || 1)) * exaggeration * 0.5 + 0.3;
  return [meshX, meshY, meshZ];
}

const AgmarProposalMarkers = ({ terrain, exaggeration }: AgmarProposalMarkersProps) => {
  const positions = useMemo(() => {
    return AGMAR_PROPOSAL_SITES.map(site => ({
      ...site,
      pos: geoToMeshPos(site.lon, site.lat, terrain, exaggeration),
    }));
  }, [terrain, exaggeration]);

  return (
    <>
      {positions.map(site => (
        <PulsingMarker key={site.name} position={site.pos} name={site.name} description={site.description} />
      ))}
    </>
  );
};

function PulsingMarker({ position, name, description }: {
  position: [number, number, number];
  name: string;
  description: string;
}) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ringRef.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.3;
      ringRef.current.scale.set(s, s, s);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.6 - Math.sin(state.clock.elapsedTime * 3) * 0.3;
    }
  });

  return (
    <group position={position}>
      {/* Core dot */}
      <mesh>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color="#10b981" />
      </mesh>
      {/* Pulsing ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.12, 0.18, 32]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* Label */}
      <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <div className="text-center whitespace-nowrap">
          <div className="px-2 py-1 rounded bg-emerald-900/80 border border-emerald-500/40 backdrop-blur-sm">
            <p className="text-[11px] font-semibold text-emerald-300">{name}</p>
            <p className="text-[8px] text-emerald-200/60 max-w-[150px] whitespace-normal">{description}</p>
          </div>
        </div>
      </Html>
    </group>
  );
}

export default AgmarProposalMarkers;
