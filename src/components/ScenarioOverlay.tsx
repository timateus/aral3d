import { useMemo, useRef, useEffect } from 'react';
import { Html, Line } from '@react-three/drei';
import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';
import type { ScenarioAction, ForestAction, DamAction, CanalAction, SettlementAction, LabelAction } from '@/types/scenario';
import * as THREE from 'three';

interface ScenarioOverlayProps {
  actions: ScenarioAction[];
  terrain: TerrainData;
  exaggeration: number;
}

function geoToMeshPos(
  lat: number, lon: number,
  bounds: GeoBounds, terrain: TerrainData, exaggeration: number,
  meshWidth: number, meshHeight: number,
): [number, number, number] | null {
  const { minLon, maxLon, minLat, maxLat } = bounds;
  const nx = (lon - minLon) / (maxLon - minLon);
  const ny = (lat - minLat) / (maxLat - minLat);
  const x = (nx - 0.5) * meshWidth;
  const planeY = (ny - 0.5) * meshHeight;
  const inBounds = nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1;
  let zHeight = 0;
  if (inBounds) {
    const pixelX = Math.floor(nx * (terrain.width - 1));
    const pixelY = Math.floor((1 - ny) * (terrain.height - 1));
    const idx = pixelY * terrain.width + pixelX;
    let elev = terrain.elevations[idx] || terrain.minElevation;
    if (terrain.noDataValue !== null && elev === terrain.noDataValue) elev = terrain.minElevation;
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const normalized = (elev - terrain.minElevation) / elevRange;
    const maxMeshHeight = 10 * (exaggeration / 100);
    zHeight = normalized * maxMeshHeight;
  }
  return [x, zHeight, -planeY];
}

// Convert km radius to approximate mesh units
function kmToMeshUnits(km: number, bounds: GeoBounds, meshWidth: number): number {
  const lonSpan = bounds.maxLon - bounds.minLon;
  const degPerKm = 1 / 111; // rough approximation
  const fraction = (km * degPerKm) / lonSpan;
  return fraction * meshWidth;
}

const ForestOverlay = ({ action, terrain, exaggeration, meshWidth, meshHeight }: {
  action: ForestAction; terrain: TerrainData; exaggeration: number; meshWidth: number; meshHeight: number;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const bounds = terrain.bounds;

  const count = Math.floor((action.density ?? 0.5) * 150);
  const radiusMesh = kmToMeshUnits(action.radius, bounds, meshWidth);

  useEffect(() => {
    if (!meshRef.current || !bounds) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radiusMesh;
      const offsetX = Math.cos(angle) * r;
      const offsetZ = Math.sin(angle) * r;

      // Convert offset back to geo coords to sample elevation
      const centerPos = geoToMeshPos(action.lat, action.lon, bounds, terrain, exaggeration, meshWidth, meshHeight);
      if (!centerPos) continue;

      const x = centerPos[0] + offsetX;
      const z = centerPos[2] + offsetZ;

      // Sample elevation at this mesh position
      const nx = (x / meshWidth) + 0.5;
      const ny = -(z / meshHeight) + 0.5;
      let y = 0;
      if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) {
        const px = Math.floor(nx * (terrain.width - 1));
        const py = Math.floor((1 - ny) * (terrain.height - 1));
        const idx = py * terrain.width + px;
        let elev = terrain.elevations[idx] || terrain.minElevation;
        if (terrain.noDataValue !== null && elev === terrain.noDataValue) elev = terrain.minElevation;
        const elevRange = terrain.maxElevation - terrain.minElevation || 1;
        const normalized = (elev - terrain.minElevation) / elevRange;
        y = normalized * 10 * (exaggeration / 100);
      }

      const scale = 0.03 + Math.random() * 0.05;
      dummy.position.set(x, y + scale * 0.5, z);
      dummy.scale.set(scale, scale * 2, scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [action, terrain, exaggeration, bounds, meshWidth, meshHeight, count, radiusMesh]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <coneGeometry args={[1, 1, 6]} />
      <meshStandardMaterial color="#2d8f3e" />
    </instancedMesh>
  );
};

const DamOverlay = ({ action, terrain, exaggeration, meshWidth, meshHeight }: {
  action: DamAction; terrain: TerrainData; exaggeration: number; meshWidth: number; meshHeight: number;
}) => {
  const bounds = terrain.bounds;
  const pos = geoToMeshPos(action.lat, action.lon, bounds, terrain, exaggeration, meshWidth, meshHeight);
  if (!pos) return null;

  const w = kmToMeshUnits((action.width ?? 200) / 1000, bounds, meshWidth);
  const h = ((action.height ?? 30) / 500) * (exaggeration / 100);

  return (
    <mesh position={[pos[0], pos[1] + h / 2, pos[2]]}>
      <boxGeometry args={[w, h, w * 0.15]} />
      <meshStandardMaterial color="#8c8c8c" />
    </mesh>
  );
};

const CanalOverlay = ({ action, terrain, exaggeration, meshWidth, meshHeight }: {
  action: CanalAction; terrain: TerrainData; exaggeration: number; meshWidth: number; meshHeight: number;
}) => {
  const bounds = terrain.bounds;
  const start = geoToMeshPos(action.start_lat, action.start_lon, bounds, terrain, exaggeration, meshWidth, meshHeight);
  const end = geoToMeshPos(action.end_lat, action.end_lon, bounds, terrain, exaggeration, meshWidth, meshHeight);
  if (!start || !end) return null;

  // Interpolate points along the canal
  const segments = 20;
  const points: [number, number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const lat = action.start_lat + (action.end_lat - action.start_lat) * t;
    const lon = action.start_lon + (action.end_lon - action.start_lon) * t;
    const p = geoToMeshPos(lat, lon, bounds, terrain, exaggeration, meshWidth, meshHeight);
    if (p) points.push([p[0], p[1] + 0.04, p[2]]);
  }

  if (points.length < 2) return null;

  return (
    <Line
      points={points}
      color="#4fa8d4"
      lineWidth={2}
      transparent
      opacity={0.8}
    />
  );
};

const SettlementOverlay = ({ action, terrain, exaggeration, meshWidth, meshHeight }: {
  action: SettlementAction; terrain: TerrainData; exaggeration: number; meshWidth: number; meshHeight: number;
}) => {
  const bounds = terrain.bounds;
  const s = (action.size ?? 2) * 0.01;
  const buildings = useMemo(() => {
    const b: { x: number; z: number; h: number }[] = [];
    const n = (action.size ?? 2) * 3;
    for (let i = 0; i < n; i++) {
      b.push({
        x: (Math.random() - 0.5) * s * 4,
        z: (Math.random() - 0.5) * s * 4,
        h: s * (0.5 + Math.random()),
      });
    }
    return b;
  }, [action, s]);

  const pos = geoToMeshPos(action.lat, action.lon, bounds, terrain, exaggeration, meshWidth, meshHeight);
  if (!pos) return null;

  return (
    <group position={pos}>
      {buildings.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]}>
          <boxGeometry args={[s * 0.5, b.h, s * 0.5]} />
          <meshStandardMaterial color="#d4a84f" />
        </mesh>
      ))}
      <Html position={[0, s * 2, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <div style={{
          color: '#d4a84f',
          fontSize: '9px',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 500,
          whiteSpace: 'nowrap',
          textShadow: '0 1px 4px rgba(0,0,0,0.8)',
          background: 'rgba(0,0,0,0.6)',
          padding: '1px 4px',
          borderRadius: '3px',
        }}>
          {action.name}
        </div>
      </Html>
    </group>
  );
};

const LabelOverlay = ({ action, terrain, exaggeration, meshWidth, meshHeight }: {
  action: LabelAction; terrain: TerrainData; exaggeration: number; meshWidth: number; meshHeight: number;
}) => {
  const bounds = terrain.bounds;
  const pos = geoToMeshPos(action.lat, action.lon, bounds, terrain, exaggeration, meshWidth, meshHeight);
  if (!pos) return null;

  return (
    <group position={[pos[0], pos[1] + 0.2, pos[2]]}>
      <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <div style={{
          color: '#ffffff',
          fontSize: '10px',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 600,
          whiteSpace: 'nowrap',
          textShadow: '0 1px 4px rgba(0,0,0,0.8)',
          background: 'rgba(0,0,0,0.5)',
          padding: '2px 6px',
          borderRadius: '4px',
        }}>
          {action.text}
        </div>
      </Html>
    </group>
  );
};

const ScenarioOverlay = ({ actions, terrain, exaggeration }: ScenarioOverlayProps) => {
  const bounds = terrain.bounds;
  if (!bounds) return null;

  const w = terrain.width;
  const h = terrain.height;
  const meshWidth = 10;
  const meshHeight = 10 * (h / w);

  return (
    <group>
      {actions.map((action, i) => {
        switch (action.type) {
          case 'forest':
            return <ForestOverlay key={`f-${i}`} action={action} terrain={terrain} exaggeration={exaggeration} meshWidth={meshWidth} meshHeight={meshHeight} />;
          case 'dam':
            return <DamOverlay key={`d-${i}`} action={action} terrain={terrain} exaggeration={exaggeration} meshWidth={meshWidth} meshHeight={meshHeight} />;
          case 'canal':
            return <CanalOverlay key={`c-${i}`} action={action} terrain={terrain} exaggeration={exaggeration} meshWidth={meshWidth} meshHeight={meshHeight} />;
          case 'settlement':
            return <SettlementOverlay key={`s-${i}`} action={action} terrain={terrain} exaggeration={exaggeration} meshWidth={meshWidth} meshHeight={meshHeight} />;
          case 'label':
            return <LabelOverlay key={`l-${i}`} action={action} terrain={terrain} exaggeration={exaggeration} meshWidth={meshWidth} meshHeight={meshHeight} />;
          default:
            return null;
        }
      })}
    </group>
  );
};

export default ScenarioOverlay;
