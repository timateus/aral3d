import { useMemo } from 'react';
import * as THREE from 'three';
import { Html, Line } from '@react-three/drei';
import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';

interface GeoFeaturesProps {
  terrain: TerrainData;
  exaggeration: number;
}

interface City {
  name: string;
  lat: number;
  lon: number;
}

interface RiverPath {
  name: string;
  color: string;
  coords: [number, number][]; // [lat, lon]
}

const CITIES: City[] = [
  { name: 'Nukus', lat: 42.462, lon: 59.603 },
  { name: 'Moynaq', lat: 43.773, lon: 58.690 },
  { name: 'Aralsk', lat: 46.790, lon: 61.660 },
  { name: 'Kungrad', lat: 43.005, lon: 58.690 },
  { name: 'Turtkul', lat: 41.550, lon: 60.630 },
  { name: 'Beruniy', lat: 41.690, lon: 60.750 },
  { name: 'Chimbay', lat: 42.930, lon: 59.770 },
  { name: 'Takhtakupir', lat: 43.015, lon: 59.826 },
  { name: 'Kazalinsk', lat: 45.763, lon: 62.110 },
];

const RIVERS: RiverPath[] = [
  {
    name: 'Amu Darya',
    color: '#4488cc',
    coords: [
      [41.50, 60.60], [41.55, 60.50], [41.65, 60.35], [41.80, 60.20],
      [41.95, 60.05], [42.05, 59.90], [42.20, 59.80], [42.35, 59.70],
      [42.46, 59.60], [42.55, 59.55], [42.70, 59.50], [42.85, 59.35],
      [43.00, 59.20], [43.15, 59.05], [43.30, 58.95], [43.50, 58.85],
      [43.65, 58.78], [43.77, 58.69],
    ],
  },
  {
    name: 'Syr Darya',
    color: '#5599dd',
    coords: [
      [44.50, 63.50], [44.80, 63.20], [45.10, 62.90],
      [45.40, 62.60], [45.76, 62.11], [46.00, 61.90],
      [46.30, 61.75], [46.60, 61.70], [46.79, 61.66],
    ],
  },
  {
    name: 'Qizilkum Canal',
    color: '#66aacc',
    coords: [
      [42.46, 59.60], [42.60, 59.90], [42.75, 60.10],
      [42.85, 60.35], [42.93, 59.77],
    ],
  },
];

function geoToMeshPos(
  lat: number,
  lon: number,
  bounds: GeoBounds,
  terrain: TerrainData,
  exaggeration: number,
  meshWidth: number,
  meshHeight: number,
): [number, number, number] | null {
  const { minLon, maxLon, minLat, maxLat } = bounds;
  const nx = (lon - minLon) / (maxLon - minLon);
  const ny = (lat - minLat) / (maxLat - minLat);

  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;

  const x = (nx - 0.5) * meshWidth;
  const planeY = (ny - 0.5) * meshHeight;

  // Get elevation at this pixel
  const pixelX = Math.floor(nx * (terrain.width - 1));
  const pixelY = Math.floor((1 - ny) * (terrain.height - 1));
  const idx = pixelY * terrain.width + pixelX;
  let elev = terrain.elevations[idx] || terrain.minElevation;
  if (terrain.noDataValue !== null && elev === terrain.noDataValue) {
    elev = terrain.minElevation;
  }
  const elevRange = terrain.maxElevation - terrain.minElevation || 1;
  const normalized = (elev - terrain.minElevation) / elevRange;
  const maxMeshHeight = 10 * (exaggeration / 100);
  const zHeight = normalized * maxMeshHeight;

  // After rotation [-PI/2, 0, 0]: world = (x, z_plane, -y_plane)
  return [x, zHeight, -planeY];
}

const GeoFeatures = ({ terrain, exaggeration }: GeoFeaturesProps) => {
  const bounds = terrain.bounds;
  const w = terrain.width;
  const h = terrain.height;
  const meshWidth = 10;
  const meshHeight = 10 * (h / w);

  const cityMarkers = useMemo(() => {
    if (!bounds) return [];
    return CITIES.map((city) => {
      const pos = geoToMeshPos(city.lat, city.lon, bounds, terrain, exaggeration, meshWidth, meshHeight);
      if (!pos) return null;
      return { ...city, pos: [pos[0], pos[1] + 0.15, pos[2]] as [number, number, number] };
    }).filter(Boolean) as (City & { pos: [number, number, number] })[];
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, w, h]);

  const riverLineData = useMemo(() => {
    if (!bounds) return [];
    return RIVERS.map((river) => {
      const points: [number, number, number][] = [];
      for (const [lat, lon] of river.coords) {
        const pos = geoToMeshPos(lat, lon, bounds, terrain, exaggeration, meshWidth, meshHeight);
        if (pos) {
          points.push([pos[0], pos[1] + 0.03, pos[2]]);
        }
      }
      if (points.length < 2) return null;
      return { name: river.name, points, color: river.color };
    }).filter(Boolean) as { name: string; points: [number, number, number][]; color: string }[];
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, w, h]);

  if (!bounds) return null;

  return (
    <group>
      {cityMarkers.map((city) => (
        <group key={city.name} position={city.pos}>
          <mesh>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshStandardMaterial color="#ff4444" emissive="#ff2222" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[0, -0.08, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.15, 6]} />
            <meshStandardMaterial color="#cc3333" />
          </mesh>
          <Html position={[0, 0.18, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
            <div style={{
              background: 'rgba(13, 17, 23, 0.85)',
              color: '#e6edf3',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'monospace',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              border: '1px solid rgba(255,255,255,0.15)',
            }}>
              {city.name}
            </div>
          </Html>
        </group>
      ))}

      {riverLineData.map((river) => (
        <Line
          key={river.name}
          points={river.points}
          color={river.color}
          lineWidth={2}
          transparent
          opacity={0.85}
        />
      ))}
    </group>
  );
};

export default GeoFeatures;
