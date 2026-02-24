import { useMemo, useState, useEffect, useCallback } from 'react';
import { Html, Line } from '@react-three/drei';
import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';

interface GeoFeaturesProps {
  terrain: TerrainData;
  exaggeration: number;
  showBorders: boolean;
  showRivers: boolean;
  show13thBasin: boolean;
  show19thBasin: boolean;
  show21stBasin: boolean;
  riverInflow?: number;
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

interface NamedLabel {
  name: string;
  pos: [number, number, number];
  color: string;
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

const GeoFeatures = ({ terrain, exaggeration, showBorders, showRivers, show13thBasin, show19thBasin, show21stBasin, riverInflow }: GeoFeaturesProps) => {
  const bounds = terrain.bounds;
  const w = terrain.width;
  const h = terrain.height;
  const meshWidth = 10;
  const meshHeight = 10 * (h / w);

  const [geoJsonData, setGeoJsonData] = useState<GeoJSONCollection | null>(null);
  const [countriesData, setCountriesData] = useState<GeoJSONCollection | null>(null);
  const [basin13Data, setBasin13Data] = useState<GeoJSONCollection | null>(null);
  const [basin19Data, setBasin19Data] = useState<GeoJSONCollection | null>(null);
  const [basin21Data, setBasin21Data] = useState<GeoJSONCollection | null>(null);

  useEffect(() => {
    fetch('/data/AmuRivers.geojson')
      .then((r) => r.json())
      .then((data) => setGeoJsonData(data))
      .catch((err) => console.warn('Failed to load river GeoJSON:', err));

    fetch('/data/countries.geojson')
      .then((r) => r.json())
      .then((data) => setCountriesData(data))
      .catch((err) => console.warn('Failed to load countries GeoJSON:', err));

    fetch('/data/13cent_basin.geojson')
      .then((r) => r.json())
      .then((data) => setBasin13Data(data))
      .catch((err) => console.warn('Failed to load 13th century basin GeoJSON:', err));

    fetch('/data/19cent_basin.geojson')
      .then((r) => r.json())
      .then((data) => setBasin19Data(data))
      .catch((err) => console.warn('Failed to load 19th century basin GeoJSON:', err));

    fetch('/data/21cent_basin.geojson')
      .then((r) => r.json())
      .then((data) => setBasin21Data(data))
      .catch((err) => console.warn('Failed to load 21st century basin GeoJSON:', err));
  }, []);

  const cityMarkers = useMemo(() => {
    if (!bounds) return [];
    return CITIES.map((city) => {
      const pos = geoToMeshPos(city.lat, city.lon, bounds, terrain, exaggeration, meshWidth, meshHeight);
      if (!pos) return null;
      return { ...city, pos: [pos[0], pos[1] + 0.15, pos[2]] as [number, number, number] };
    }).filter(Boolean) as (City & { pos: [number, number, number] })[];
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, w, h]);

  const basinLabels13 = useMemo(() => {
    if (!bounds || !basin13Data) return [];
    return extractNamedLabels(basin13Data, bounds, terrain, exaggeration, meshWidth, meshHeight, '#e8a838');
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, basin13Data]);

  const basinLabels19 = useMemo(() => {
    if (!bounds || !basin19Data) return [];
    return extractNamedLabels(basin19Data, bounds, terrain, exaggeration, meshWidth, meshHeight, '#38e8a8');
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, basin19Data]);


  const basinLabels21 = useMemo(() => {
    if (!bounds || !basin21Data) return [];
    return extractNamedLabels(basin21Data, bounds, terrain, exaggeration, meshWidth, meshHeight, '#e84038');
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, basin21Data]);

  const riverLines = useMemo(() => {
    if (!bounds || !geoJsonData) return [];

    const segments: { points: [number, number, number][]; width: number }[] = [];

    for (const feature of geoJsonData.features) {
      if (feature.geometry.type !== 'LineString') continue;
      const coords = feature.geometry.coordinates as number[][];
      const sorder = (feature.properties?.sorder as number) || 1;
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
        // Scale line width by stream order
        const lineWidth = Math.max(0.5, sorder * 0.4);
        segments.push({ points, width: lineWidth });
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

  const basinLines13 = useMemo(() => {
    if (!bounds || !basin13Data) return [];
    return extractMultiLineStrings(basin13Data, bounds, terrain, exaggeration, meshWidth, meshHeight);
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, basin13Data]);

  const basinLines19 = useMemo(() => {
    if (!bounds || !basin19Data) return [];
    return extractMultiLineStrings(basin19Data, bounds, terrain, exaggeration, meshWidth, meshHeight);
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, basin19Data]);

  const basinLines21 = useMemo(() => {
    if (!bounds || !basin21Data) return [];
    return extractMultiLineStrings(basin21Data, bounds, terrain, exaggeration, meshWidth, meshHeight);
  }, [terrain, exaggeration, bounds, meshWidth, meshHeight, basin21Data]);

  if (!bounds) return null;

  return (
    <group>
      {/* Country borders */}
      {showBorders && borderLines.map((points, i) => (
        <Line
          key={`border-${i}`}
          points={points}
          color="#ffffff"
          lineWidth={1}
          transparent
          opacity={0.3}
        />
      ))}

      {/* 13th century basin */}
      {show13thBasin && basinLines13.map((points, i) => (
        <Line
          key={`basin13-${i}`}
          points={points}
          color="#e8a838"
          lineWidth={1.5}
          transparent
          opacity={0.7}
        />
      ))}

      {/* 19th century basin */}
      {show19thBasin && basinLines19.map((points, i) => (
        <Line
          key={`basin19-${i}`}
          points={points}
          color="#38e8a8"
          lineWidth={1.5}
          transparent
          opacity={0.7}
        />
      ))}

      {/* 21st century basin */}
      {show21stBasin && basinLines21.map((points, i) => (
        <Line
          key={`basin21-${i}`}
          points={points}
          color="#e84038"
          lineWidth={1.5}
          transparent
          opacity={0.7}
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

      {/* Basin hover labels - 13th century */}
      {show13thBasin && basinLabels13.map((label, i) => (
        <HoverLabel key={`label13-${i}`} label={label} />
      ))}

      {/* Basin hover labels - 19th century */}
      {show19thBasin && basinLabels19.map((label, i) => (
        <HoverLabel key={`label19-${i}`} label={label} />
      ))}

      {/* Basin hover labels - 21st century */}
      {show21stBasin && basinLabels21.map((label, i) => (
        <HoverLabel key={`label21-${i}`} label={label} />
      ))}

      {/* Rivers from GeoJSON */}
      {showRivers && riverLines.map((seg, i) => (
        <Line
          key={`river-${i}`}
          points={seg.points}
          color="#5b9bd5"
          lineWidth={seg.width}
          transparent
          opacity={0.7}
        />
      ))}
    </group>
  );
};

function extractMultiLineStrings(
  data: GeoJSONCollection,
  bounds: GeoBounds,
  terrain: TerrainData,
  exaggeration: number,
  meshWidth: number,
  meshHeight: number,
): [number, number, number][][] {
  const segments: [number, number, number][][] = [];
  for (const feature of data.features) {
    let lines: number[][][] = [];
    if (feature.geometry.type === 'LineString') {
      lines = [feature.geometry.coordinates as number[][]];
    } else if (feature.geometry.type === 'MultiLineString') {
      lines = feature.geometry.coordinates as number[][][];
    }
    for (const line of lines) {
      const points: [number, number, number][] = [];
      for (const coord of line) {
        const pos = geoToMeshPos(coord[1], coord[0], bounds, terrain, exaggeration, meshWidth, meshHeight);
        if (pos) points.push([pos[0], pos[1] + 0.04, pos[2]]);
      }
      if (points.length >= 2) segments.push(points);
    }
  }
  return segments;
}

function extractNamedLabels(
  data: GeoJSONCollection,
  bounds: GeoBounds,
  terrain: TerrainData,
  exaggeration: number,
  meshWidth: number,
  meshHeight: number,
  color: string,
): NamedLabel[] {
  const labels: NamedLabel[] = [];
  for (const feature of data.features) {
    const name = feature.properties?.Name as string | null;
    if (!name) continue;

    // Collect all coordinates to find midpoint
    let allCoords: number[][] = [];
    if (feature.geometry.type === 'LineString') {
      allCoords = feature.geometry.coordinates as number[][];
    } else if (feature.geometry.type === 'MultiLineString') {
      const lines = feature.geometry.coordinates as number[][][];
      for (const line of lines) allCoords.push(...line);
    }

    if (allCoords.length === 0) continue;

    // Use midpoint of all coordinates
    const midIdx = Math.floor(allCoords.length / 2);
    const midCoord = allCoords[midIdx];
    const pos = geoToMeshPos(midCoord[1], midCoord[0], bounds, terrain, exaggeration, meshWidth, meshHeight);
    if (pos) {
      labels.push({ name, pos: [pos[0], pos[1] + 0.12, pos[2]], color });
    }
  }
  return labels;
}

const HoverLabel = ({ label }: { label: NamedLabel }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <group position={label.pos}>
      {/* Invisible hover sphere */}
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      {/* Small dot always visible */}
      <mesh>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color={label.color} emissive={label.color} emissiveIntensity={0.5} />
      </mesh>
      {/* Label on hover */}
      {hovered && (
        <Html position={[0, 0.1, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
          <div style={{
            color: label.color,
            padding: '2px 6px',
            fontSize: '9px',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontWeight: 500,
            fontStyle: 'italic',
            letterSpacing: '0.3px',
            whiteSpace: 'nowrap',
            background: 'rgba(0,0,0,0.7)',
            borderRadius: '3px',
            textShadow: '0 1px 3px rgba(0,0,0,0.9)',
          }}>
            {label.name}
          </div>
        </Html>
      )}
    </group>
  );
};

export default GeoFeatures;
