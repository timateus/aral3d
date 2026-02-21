import { useMemo, useState, useEffect } from 'react';
import { Line } from '@react-three/drei';
import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';

interface WaterExtentLayerProps {
  terrain: TerrainData;
  exaggeration: number;
  year: number;
}

interface GeoJSONCollection {
  type: string;
  features: {
    type: string;
    geometry: { type: string; coordinates: number[][][][] | number[][][] };
    properties: Record<string, unknown>;
  }[];
}

interface YearData {
  year: number;
  file: string;
  color: string;
}

const YEAR_DATA: YearData[] = [
  { year: 1974, file: '/data/Area_1974_AG.geojson', color: '#4fc3f7' },
  { year: 1989, file: '/data/Area_1989_AG.geojson', color: '#29b6f6' },
  { year: 1999, file: '/data/Area_1999_AG.geojson', color: '#ffa726' },
  { year: 2004, file: '/data/Area_2004_AG.geojson', color: '#ff7043' },
  { year: 2009, file: '/data/Area_2009_AG.geojson', color: '#f44336' },
  { year: 2015, file: '/data/Area_2015_AG.geojson', color: '#ef5350' },
];

function geoToMeshPos(
  lat: number, lon: number, bounds: GeoBounds, terrain: TerrainData,
  exaggeration: number, meshWidth: number, meshHeight: number,
): [number, number, number] | null {
  const { minLon, maxLon, minLat, maxLat } = bounds;
  const nx = (lon - minLon) / (maxLon - minLon);
  const ny = (lat - minLat) / (maxLat - minLat);
  const x = (nx - 0.5) * meshWidth;
  const planeY = (ny - 0.5) * meshHeight;
  let zHeight = 0;
  if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) {
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

const WaterExtentLayer = ({ terrain, exaggeration, year }: WaterExtentLayerProps) => {
  const bounds = terrain.bounds;
  const w = terrain.width;
  const h = terrain.height;
  const meshWidth = 10;
  const meshHeight = 10 * (h / w);

  const [datasets, setDatasets] = useState<Map<number, GeoJSONCollection>>(new Map());

  useEffect(() => {
    for (const yd of YEAR_DATA) {
      fetch(yd.file)
        .then((r) => r.json())
        .then((data) => setDatasets((prev) => new Map(prev).set(yd.year, data)))
        .catch((err) => console.warn(`Failed to load ${yd.file}:`, err));
    }
  }, []);

  // Snap to nearest available year
  const nearestYear = useMemo(() => {
    const years = YEAR_DATA.map((d) => d.year);
    let best = years[0];
    let bestDist = Math.abs(year - best);
    for (const y of years) {
      const d = Math.abs(year - y);
      if (d < bestDist) { best = y; bestDist = d; }
    }
    return best;
  }, [year]);

  const color = useMemo(() => {
    return YEAR_DATA.find((d) => d.year === nearestYear)?.color || '#4fc3f7';
  }, [nearestYear]);

  const outlines = useMemo(() => {
    if (!bounds) return [];
    const data = datasets.get(nearestYear);
    if (!data) return [];
    return extractPolygonOutlines(data, bounds, terrain, exaggeration, meshWidth, meshHeight);
  }, [datasets, nearestYear, bounds, terrain, exaggeration, meshWidth, meshHeight]);

  if (!bounds) return null;

  return (
    <group>
      {outlines.map((points, i) => (
        <Line
          key={`wext-${i}`}
          points={points}
          color={color}
          lineWidth={2}
          transparent
          opacity={0.85}
        />
      ))}
    </group>
  );
};

function extractPolygonOutlines(
  data: GeoJSONCollection, bounds: GeoBounds, terrain: TerrainData,
  exaggeration: number, meshWidth: number, meshHeight: number,
): [number, number, number][][] {
  const segments: [number, number, number][][] = [];
  for (const feature of data.features) {
    let rings: number[][][] = [];
    if (feature.geometry.type === 'Polygon') {
      rings = feature.geometry.coordinates as number[][][];
    } else if (feature.geometry.type === 'MultiPolygon') {
      for (const poly of feature.geometry.coordinates as number[][][][]) {
        rings.push(...poly);
      }
    }
    for (const ring of rings) {
      const points: [number, number, number][] = [];
      for (const coord of ring) {
        const pos = geoToMeshPos(coord[1], coord[0], bounds, terrain, exaggeration, meshWidth, meshHeight);
        if (pos) points.push([pos[0], pos[1] + 0.05, pos[2]]);
      }
      if (points.length >= 2) segments.push(points);
    }
  }
  return segments;
}

export default WaterExtentLayer;
