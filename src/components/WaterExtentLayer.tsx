import { useMemo, useState, useEffect } from 'react';
import { Line } from '@react-three/drei';
import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';
import * as THREE from 'three';

interface WaterExtentLayerProps {
  terrain: TerrainData;
  exaggeration: number;
  year: number;
  interpolate?: boolean;
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

const WaterExtentLayer = ({ terrain, exaggeration, year, interpolate = false }: WaterExtentLayerProps) => {
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

  // Find the two bounding years for interpolation
  const { lowerYear, upperYear, t } = useMemo(() => {
    const years = YEAR_DATA.map((d) => d.year).sort((a, b) => a - b);
    if (year <= years[0]) return { lowerYear: years[0], upperYear: years[0], t: 0 };
    if (year >= years[years.length - 1]) return { lowerYear: years[years.length - 1], upperYear: years[years.length - 1], t: 0 };
    let lo = years[0], hi = years[years.length - 1];
    for (let i = 0; i < years.length - 1; i++) {
      if (year >= years[i] && year <= years[i + 1]) {
        lo = years[i];
        hi = years[i + 1];
        break;
      }
    }
    const frac = lo === hi ? 0 : (year - lo) / (hi - lo);
    return { lowerYear: lo, upperYear: hi, t: frac };
  }, [year]);

  // Build outlines for both bounding years
  const lowerOutlines = useMemo(() => {
    if (!bounds) return [];
    const data = datasets.get(lowerYear);
    if (!data) return [];
    return extractPolygonOutlines(data, bounds, terrain, exaggeration, meshWidth, meshHeight);
  }, [datasets, lowerYear, bounds, terrain, exaggeration, meshWidth, meshHeight]);

  const upperOutlines = useMemo(() => {
    if (!bounds || lowerYear === upperYear) return [];
    const data = datasets.get(upperYear);
    if (!data) return [];
    return extractPolygonOutlines(data, bounds, terrain, exaggeration, meshWidth, meshHeight);
  }, [datasets, upperYear, lowerYear, bounds, terrain, exaggeration, meshWidth, meshHeight]);

  // Pick color based on interpolation
  const color = useMemo(() => {
    const lc = YEAR_DATA.find((d) => d.year === lowerYear)?.color || '#4fc3f7';
    const uc = YEAR_DATA.find((d) => d.year === upperYear)?.color || '#ef5350';
    const c1 = new THREE.Color(lc);
    const c2 = new THREE.Color(uc);
    return new THREE.Color().lerpColors(c1, c2, t).getStyle();
  }, [lowerYear, upperYear, t]);

  // Interpolated outlines: lerp vertex positions between lower and upper
  const interpolatedOutlines = useMemo(() => {
    if (!interpolate || lowerYear === upperYear || lowerOutlines.length === 0 || upperOutlines.length === 0) return null;
    const count = Math.min(lowerOutlines.length, upperOutlines.length);
    const result: [number, number, number][][] = [];
    for (let i = 0; i < count; i++) {
      const lo = lowerOutlines[i];
      const hi = upperOutlines[i];
      // Resample both to the same point count
      const targetLen = Math.max(lo.length, hi.length);
      const loResampled = resampleRing(lo, targetLen);
      const hiResampled = resampleRing(hi, targetLen);
      const lerped: [number, number, number][] = [];
      for (let j = 0; j < targetLen; j++) {
        lerped.push([
          loResampled[j][0] + (hiResampled[j][0] - loResampled[j][0]) * t,
          loResampled[j][1] + (hiResampled[j][1] - loResampled[j][1]) * t,
          loResampled[j][2] + (hiResampled[j][2] - loResampled[j][2]) * t,
        ]);
      }
      result.push(lerped);
    }
    return result;
  }, [interpolate, lowerYear, upperYear, lowerOutlines, upperOutlines, t]);

  // Fallback: snap to nearest
  const showLower = t <= 0.5 || lowerYear === upperYear;
  const showUpper = t > 0.5 && lowerYear !== upperYear;
  const snappedOutlines = showUpper ? upperOutlines : lowerOutlines;

  const activeOutlines = interpolatedOutlines ?? snappedOutlines;

  if (!bounds) return null;

  return (
    <group>
      {activeOutlines.map((points, i) => (
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

/** Resample a polyline to exactly `count` evenly spaced points */
function resampleRing(
  ring: [number, number, number][],
  count: number,
): [number, number, number][] {
  if (ring.length === count) return ring;
  if (ring.length === 0 || count <= 0) return [];
  if (count === 1) return [ring[0]];

  // Compute cumulative arc lengths
  const lengths: number[] = [0];
  for (let i = 1; i < ring.length; i++) {
    const dx = ring[i][0] - ring[i - 1][0];
    const dy = ring[i][1] - ring[i - 1][1];
    const dz = ring[i][2] - ring[i - 1][2];
    lengths.push(lengths[i - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz));
  }
  const totalLen = lengths[lengths.length - 1];
  if (totalLen === 0) return Array(count).fill(ring[0]);

  const result: [number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    const targetDist = (i / (count - 1)) * totalLen;
    // Find segment
    let seg = 0;
    for (seg = 0; seg < lengths.length - 1; seg++) {
      if (lengths[seg + 1] >= targetDist) break;
    }
    const segLen = lengths[seg + 1] - lengths[seg];
    const frac = segLen === 0 ? 0 : (targetDist - lengths[seg]) / segLen;
    const a = ring[seg];
    const b = ring[Math.min(seg + 1, ring.length - 1)];
    result.push([
      a[0] + (b[0] - a[0]) * frac,
      a[1] + (b[1] - a[1]) * frac,
      a[2] + (b[2] - a[2]) * frac,
    ]);
  }
  return result;
}

export default WaterExtentLayer;
