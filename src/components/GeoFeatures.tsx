import { useMemo, useState, useEffect } from 'react';
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

interface GeoJSONFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: number[][] | number[][][] | number[][][][];
  };
  properties: Record<string, unknown>;
}

interface GeoJSONCollection {
  type: string;
  features: GeoJSONFeature[];
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

  const x = (nx - 0.5) * meshWidth;
  const planeY = (ny - 0.5) * meshHeight;

  const inBounds = nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1;
  let zHeight = 0;

  if (inBounds) {
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
    zHeight = normalized * maxMeshHeight;
  }

  return [x, zHeight, -planeY];
}

const GeoFeatures = ({ terrain, exaggeration }: GeoFeaturesProps) => {
  const bounds = terrain.bounds;
  const w = terrain.width;
  const h = terrain.height;
  const meshWidth = 10;
  const meshHeight = 10 * (h / w);

  const [geoJsonData, setGeoJsonData] = useState<GeoJSONCollection | null>(null);
  const [countriesData, setCountriesData] = useState<GeoJSONCollection | null>(null);

  useEffect(() => {
    fetch('/data/AmuRivers.geojson')
      .then((r) => r.json())
      .then((data) => setGeoJsonData(data))
      .catch((err) => console.warn('Failed to load river GeoJSON:', err));

    fetch('/data/countries.geojson')
      .then((r) => r.json())
      .then((data) => setCountriesData(data))
      .catch((err) => console.warn('Failed to load countries GeoJSON:', err));
  }, []);

  const cityMarkers = useMemo(() => {
    if (!bounds) return [];
    return CITIES.map((city) => {
      const pos = geoToMeshPos(city.lat, city.lon, bounds, terrain, exaggeration, meshWidth, meshHeight);
      if (!pos) return null;
      return { ...city, pos: [pos[0], pos[1] + 0.15, pos[2]] as [number, number, number] };
    }).filter(Boolean) as (City & { pos: [number, number, number] })[];
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, w, h]);

  const riverLines = useMemo(() => {
    if (!bounds || !geoJsonData) return [];

    // Group features into continuous river segments
    const segments: [number, number, number][][] = [];

    for (const feature of geoJsonData.features) {
      if (feature.geometry.type !== 'LineString') continue;
      const coords = feature.geometry.coordinates as number[][];
      const points: [number, number, number][] = [];

      for (const coord of coords) {
        const lon = coord[0] as number;
        const lat = coord[1] as number;
        const pos = geoToMeshPos(lat, lon, bounds, terrain, exaggeration, meshWidth, meshHeight);
        if (pos) {
          points.push([pos[0], pos[1] + 0.03, pos[2]]);
        }
      }

      if (points.length >= 2) {
        segments.push(points);
      }
    }

    return segments;
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, geoJsonData]);

  const BORDER_COUNTRIES = ['Uzbekistan'];

  const borderLines = useMemo(() => {
    if (!bounds || !countriesData) return [];

    const segments: [number, number, number][][] = [];

    for (const feature of countriesData.features) {
      const name = feature.properties?.name as string;
      if (!BORDER_COUNTRIES.includes(name)) continue;

      const geomType = feature.geometry.type;
      let rings: number[][][] = [];

      if (geomType === 'Polygon') {
        rings = feature.geometry.coordinates as number[][][];
      } else if (geomType === 'MultiPolygon') {
        const polys = feature.geometry.coordinates as number[][][][];
        for (const poly of polys) {
          rings.push(...poly);
        }
      }

      for (const ring of rings) {
        const points: [number, number, number][] = [];
        for (const coord of ring) {
          const lon = coord[0];
          const lat = coord[1];
          const pos = geoToMeshPos(lat, lon, bounds, terrain, exaggeration, meshWidth, meshHeight);
          if (pos) {
            points.push([pos[0], pos[1] + 0.02, pos[2]]);
          }
        }
        if (points.length >= 2) {
          segments.push(points);
        }
      }
    }

    return segments;
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, countriesData]);

  if (!bounds) return null;

  return (
    <group>
      {/* Country borders */}
      {borderLines.map((points, i) => (
        <Line
          key={`border-${i}`}
          points={points}
          color="#ffffff"
          lineWidth={1}
          transparent
          opacity={0.3}
        />
      ))}

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

      {/* Rivers from GeoJSON */}
      {riverLines.map((points, i) => (
        <Line
          key={`river-${i}`}
          points={points}
          color="#5b9bd5"
          lineWidth={1.5}
          transparent
          opacity={0.7}
        />
      ))}
    </group>
  );
};

export default GeoFeatures;
