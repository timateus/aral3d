import { useMemo } from 'react';
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
  { name: 'Aral', lat: 46.790, lon: 61.660 },
  { name: 'Kungrad', lat: 43.005, lon: 58.690 },
  { name: 'Chimbay', lat: 42.930, lon: 59.770 },
  { name: 'Takhtakupir', lat: 43.015, lon: 59.826 },
  { name: 'Qazaly', lat: 45.763, lon: 62.110 },
];

// More accurate river paths based on geographic data
// Bounds: 57°E–63°E, 42°N–48°N
const RIVERS: RiverPath[] = [
  {
    name: 'Amu Darya',
    color: '#5b9bd5',
    coords: [
      // Enters map from south near Nukus area, flowing NW through delta to former Aral shore
      [42.00, 60.65],
      [42.05, 60.55],
      [42.10, 60.40],
      [42.18, 60.25],
      [42.25, 60.10],
      [42.30, 59.95],
      [42.35, 59.80],
      [42.40, 59.68],
      [42.46, 59.60], // Nukus
      [42.50, 59.55],
      [42.55, 59.52],
      [42.62, 59.50],
      [42.70, 59.48],
      [42.78, 59.42],
      [42.85, 59.35],
      [42.90, 59.28],
      [42.95, 59.20],
      [43.02, 59.12],
      [43.10, 59.05],
      [43.18, 58.98],
      [43.25, 58.92],
      [43.32, 58.88],
      [43.40, 58.84],
      [43.48, 58.80],
      [43.55, 58.76],
      [43.62, 58.73],
      [43.70, 58.70],
      [43.77, 58.69], // Moynaq - former Aral shore
      [43.85, 58.68],
      [43.95, 58.70],
      [44.05, 58.75],
      [44.15, 58.82],
      [44.25, 58.90], // Into former Aral Sea bed
    ],
  },
  {
    name: 'Syr Darya',
    color: '#5b9bd5',
    coords: [
      // Enters from east, flows west through Qazaly toward Aral (city) and into northern Aral Sea
      [43.80, 63.00], // enters map from east
      [43.90, 62.85],
      [44.05, 62.65],
      [44.18, 62.50],
      [44.30, 62.38],
      [44.45, 62.28],
      [44.60, 62.20],
      [44.80, 62.15],
      [45.00, 62.12],
      [45.20, 62.10],
      [45.40, 62.10],
      [45.60, 62.10],
      [45.76, 62.11], // Qazaly
      [45.90, 62.05],
      [46.05, 61.95],
      [46.15, 61.85],
      [46.25, 61.78],
      [46.35, 61.73],
      [46.50, 61.70],
      [46.60, 61.68],
      [46.70, 61.66],
      [46.79, 61.66], // Aral city
      [46.85, 61.60],
      [46.90, 61.50],
      [46.92, 61.35],
      [46.90, 61.20], // Into northern Aral Sea
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
      {/* City markers */}
      {cityMarkers.map((city) => (
        <group key={city.name} position={city.pos}>
          <mesh>
            <sphereGeometry args={[0.04, 10, 10]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.6} />
          </mesh>
          <Html position={[0, 0.12, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
            <div style={{
              color: 'rgba(255, 255, 255, 0.9)',
              padding: '1px 4px',
              fontSize: '9px',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 400,
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
              textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0px 2px rgba(0,0,0,0.6)',
            }}>
              {city.name}
            </div>
          </Html>
        </group>
      ))}

      {/* Rivers */}
      {riverLineData.map((river) => (
        <Line
          key={river.name}
          points={river.points}
          color={river.color}
          lineWidth={1.5}
          transparent
          opacity={0.7}
        />
      ))}
    </group>
  );
};

export default GeoFeatures;
