import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { useThree } from '@react-three/fiber';
import { TerrainData } from '@/lib/geotiff-loader';

export type WaterwayTypeFilter = 'all' | 'canal' | 'river' | 'stream' | 'drain' | 'ditch' | 'dam';

interface WaterwayFeature {
  name: string | null;
  type: string;
  width: number | null;
  segments: [number, number][][]; // [lon, lat][][]
}

interface WaterwaysLayerProps {
  terrain: TerrainData;
  exaggeration: number;
  typeFilter: WaterwayTypeFilter;
  /** When true, clicks trace connected waterway network instead of showing tooltip */
  traceMode?: boolean;
  /** External signal to clear current trace */
  clearTraceSignal?: number;
}

const TYPE_COLORS: Record<string, string> = {
  canal: '#3b82f6',
  river: '#1d4ed8',
  stream: '#60a5fa',
  drain: '#94a3b8',
  ditch: '#78716c',
  dam: '#dc2626',
  wadi: '#d97706',
  weir: '#ef4444',
  default: '#6b7280',
};

/** Simplify a segment by keeping every Nth point (Douglas-Peucker lite) */
function simplifySegment(seg: [number, number][], maxPoints: number): [number, number][] {
  if (seg.length <= maxPoints) return seg;
  const step = (seg.length - 1) / (maxPoints - 1);
  const result: [number, number][] = [];
  for (let i = 0; i < maxPoints - 1; i++) {
    result.push(seg[Math.round(i * step)]);
  }
  result.push(seg[seg.length - 1]); // always keep last
  return result;
}

/** Same projection as GeoFeatures.geoToMeshPos */
function geoToMeshPos(
  lat: number, lon: number,
  bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  terrain: TerrainData,
  exaggeration: number,
  meshWidth: number, meshHeight: number,
): [number, number, number] | null {
  const nx = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
  const ny = (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);

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

  return [x, zHeight + 0.03, -planeY];
}

// Module-level cache so data survives unmount/remount
let _cachedFeatures: WaterwayFeature[] | null = null;
let _featuresFetchPromise: Promise<WaterwayFeature[]> | null = null;

export function isWaterwaysCached(): boolean { return _cachedFeatures !== null; }

function fetchWaterwayFeatures(): Promise<WaterwayFeature[]> {
  if (_cachedFeatures) return Promise.resolve(_cachedFeatures);
  if (_featuresFetchPromise) return _featuresFetchPromise;
  _featuresFetchPromise = fetch('/data/waterwaysRegion.geojson')
    .then(r => r.json())
    .then(data => {
      const parsed: WaterwayFeature[] = [];
      for (const f of data.features) {
        const props = f.properties || {};
        const geom = f.geometry;
        if (!geom) continue;
        let segments: [number, number][][] = [];
        if (geom.type === 'LineString') {
          segments = [geom.coordinates.map((c: number[]) => [c[0], c[1]] as [number, number])];
        } else if (geom.type === 'MultiLineString') {
          segments = geom.coordinates.map((line: number[][]) =>
            line.map((c: number[]) => [c[0], c[1]] as [number, number])
          );
        } else continue;
        const simplified = segments.map(s => simplifySegment(s, 30));
        parsed.push({ name: props.name || null, type: props.type || 'unknown', width: props.width || null, segments: simplified });
      }
      _cachedFeatures = parsed;
      return parsed;
    });
  return _featuresFetchPromise;
}

const WaterwaysLayer = ({ terrain, exaggeration, typeFilter, traceMode = false, clearTraceSignal = 0 }: WaterwaysLayerProps) => {
  const [features, setFeatures] = useState<WaterwayFeature[]>(_cachedFeatures || []);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [tracedIdxs, setTracedIdxs] = useState<Set<number>>(new Set());
  const prevExagg = useRef(exaggeration);

  const meshWidth = 10;
  const meshHeight = 10 * (terrain.height / terrain.width);
  const bounds = terrain.bounds || { minLon: 56, maxLon: 62, minLat: 42, maxLat: 47 };

  useEffect(() => {
    if (_cachedFeatures) { setFeatures(_cachedFeatures); return; }
    fetchWaterwayFeatures().then(setFeatures).catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return features;
    return features.filter(f => f.type === typeFilter);
  }, [features, typeFilter]);

  // Clear traced highlight when external signal changes or trace mode toggles off
  useEffect(() => { setTracedIdxs(new Set()); }, [clearTraceSignal, traceMode, typeFilter]);

  // Build adjacency graph on the *full* feature list (so traces follow into Amu Darya
  // even when typeFilter hides other types). Snap endpoints to a small grid to merge near-identical points.
  const graph = useMemo(() => {
    if (features.length === 0) return null;
    const SNAP = 0.0005; // ~50m
    const key = (lon: number, lat: number) =>
      `${Math.round(lon / SNAP)}:${Math.round(lat / SNAP)}`;

    const featureKeys: string[][] = features.map(f => {
      const ks: string[] = [];
      for (const seg of f.segments) {
        if (seg.length === 0) continue;
        ks.push(key(seg[0][0], seg[0][1]));
        ks.push(key(seg[seg.length - 1][0], seg[seg.length - 1][1]));
      }
      return ks;
    });

    const keyToFeatures = new Map<string, Set<number>>();
    featureKeys.forEach((ks, fi) => {
      for (const k of ks) {
        if (!keyToFeatures.has(k)) keyToFeatures.set(k, new Set());
        keyToFeatures.get(k)!.add(fi);
      }
    });

    return { featureKeys, keyToFeatures };
  }, [features]);

  /** BFS expand from a starting feature index across connected endpoints */
  const traceFrom = useCallback((startIdx: number): Set<number> => {
    if (!graph) return new Set([startIdx]);
    const visited = new Set<number>([startIdx]);
    const queue: number[] = [startIdx];
    let safety = 5000;
    while (queue.length && safety-- > 0) {
      const cur = queue.shift()!;
      const ks = graph.featureKeys[cur];
      for (const k of ks) {
        const nbrs = graph.keyToFeatures.get(k);
        if (!nbrs) continue;
        for (const n of nbrs) {
          if (!visited.has(n)) {
            visited.add(n);
            queue.push(n);
          }
        }
      }
    }
    return visited;
  }, [graph]);

  // Pre-compute normalized XZ positions (terrain-independent) and only apply Y on exaggeration change
  const flatPositions = useMemo(() => {
    if (filtered.length === 0) return null;

    const positions: number[] = [];
    const colors: number[] = [];
    const elevIndices: number[] = []; // terrain pixel index for each vertex
    const color = new THREE.Color();

    for (const f of filtered) {
      color.set(TYPE_COLORS[f.type] || TYPE_COLORS.default);

      for (const seg of f.segments) {
        for (let i = 0; i < seg.length - 1; i++) {
          const lon1 = seg[i][0], lat1 = seg[i][1];
          const lon2 = seg[i + 1][0], lat2 = seg[i + 1][1];

          const nx1 = (lon1 - bounds.minLon) / (bounds.maxLon - bounds.minLon);
          const ny1 = (lat1 - bounds.minLat) / (bounds.maxLat - bounds.minLat);
          const nx2 = (lon2 - bounds.minLon) / (bounds.maxLon - bounds.minLon);
          const ny2 = (lat2 - bounds.minLat) / (bounds.maxLat - bounds.minLat);

          if (nx1 < 0 || nx1 > 1 || ny1 < 0 || ny1 > 1) continue;
          if (nx2 < 0 || nx2 > 1 || ny2 < 0 || ny2 > 1) continue;

          const x1 = (nx1 - 0.5) * meshWidth;
          const z1 = -((ny1 - 0.5) * meshHeight);
          const x2 = (nx2 - 0.5) * meshWidth;
          const z2 = -((ny2 - 0.5) * meshHeight);

          const px1 = Math.floor(nx1 * (terrain.width - 1));
          const py1 = Math.floor((1 - ny1) * (terrain.height - 1));
          const px2 = Math.floor(nx2 * (terrain.width - 1));
          const py2 = Math.floor((1 - ny2) * (terrain.height - 1));

          positions.push(x1, 0, z1, x2, 0, z2); // Y=0 placeholder
          elevIndices.push(py1 * terrain.width + px1, py2 * terrain.width + px2);
          colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
        }
      }
    }

    if (positions.length === 0) return null;
    return { positions: new Float32Array(positions), colors: new Float32Array(colors), elevIndices };
  }, [filtered, bounds, meshWidth, meshHeight, terrain.width, terrain.height]);

  // Apply elevation and build fat line geometry
  const { size } = useThree();

  const fatLinesObject = useMemo(() => {
    if (!flatPositions) return null;

    const { positions, colors, elevIndices } = flatPositions;
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const maxMeshHeight = 10 * (exaggeration / 100);

    const posArray = new Float32Array(positions);
    for (let v = 0; v < elevIndices.length; v++) {
      const idx = elevIndices[v];
      let elev = terrain.elevations[idx] || terrain.minElevation;
      if (terrain.noDataValue !== null && elev === terrain.noDataValue) {
        elev = terrain.minElevation;
      }
      const normalized = (elev - terrain.minElevation) / elevRange;
      posArray[v * 3 + 1] = normalized * maxMeshHeight + 0.03;
    }

    const geo = new LineSegmentsGeometry();
    geo.setPositions(posArray);
    geo.setColors(colors);

    const mat = new LineMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      linewidth: 2,
      resolution: new THREE.Vector2(size.width, size.height),
    });

    const line = new LineSegments2(geo, mat);
    line.computeLineDistances();
    return line;
  }, [flatPositions, exaggeration, terrain.elevations, terrain.minElevation, terrain.maxElevation, terrain.noDataValue, size.width, size.height]);

  // Dispose old fat lines
  useEffect(() => {
    return () => {
      if (fatLinesObject) {
        fatLinesObject.geometry.dispose();
        (fatLinesObject.material as LineMaterial).dispose();
      }
    };
  }, [fatLinesObject]);

  // Also keep a thin invisible lineSegments for click raycasting (Line2 doesn't raycast well)
  const lineGeometry = useMemo(() => {
    if (!flatPositions) return null;
    const { positions, elevIndices } = flatPositions;
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const maxMeshHeight = 10 * (exaggeration / 100);
    const posArray = new Float32Array(positions);
    for (let v = 0; v < elevIndices.length; v++) {
      const idx = elevIndices[v];
      let elev = terrain.elevations[idx] || terrain.minElevation;
      if (terrain.noDataValue !== null && elev === terrain.noDataValue) elev = terrain.minElevation;
      const normalized = (elev - terrain.minElevation) / elevRange;
      posArray[v * 3 + 1] = normalized * maxMeshHeight + 0.03;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    return geom;
  }, [flatPositions, exaggeration, terrain.elevations, terrain.minElevation, terrain.maxElevation, terrain.noDataValue]);

  // Click: find nearest feature; in trace mode also expand connected network
  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    // In trace mode we search ALL features (so we can pick the underlying river too).
    const searchPool = traceMode ? features : filtered;
    if (searchPool.length === 0) return;

    const px = e.point.x;
    const py = e.point.y;
    const pz = e.point.z;

    let bestDist = Infinity;
    let bestIdx = -1; // index into `features` (when traceMode) or `filtered`

    for (let fi = 0; fi < searchPool.length; fi++) {
      const f = searchPool[fi];
      for (const seg of f.segments) {
        const step = Math.max(1, Math.floor(seg.length / 5));
        for (let i = 0; i < seg.length; i += step) {
          const p = geoToMeshPos(seg[i][1], seg[i][0], bounds, terrain, exaggeration, meshWidth, meshHeight);
          if (!p) continue;
          const d = (p[0] - px) ** 2 + (p[1] - py) ** 2 + (p[2] - pz) ** 2;
          if (d < bestDist) {
            bestDist = d;
            bestIdx = fi;
          }
        }
      }
    }

    if (traceMode) {
      if (bestDist < 0.4 && bestIdx >= 0) {
        // bestIdx is into `features` directly
        setTracedIdxs(traceFrom(bestIdx));
      } else {
        setTracedIdxs(new Set());
      }
      return;
    }

    if (bestDist < 0.15 && bestIdx >= 0) {
      setSelectedIdx(prev => prev === bestIdx ? null : bestIdx);
    } else {
      setSelectedIdx(null);
    }
  }, [filtered, features, bounds, meshWidth, meshHeight, terrain, exaggeration, traceMode, traceFrom]);

  const selectedLabel = useMemo(() => {
    if (selectedIdx === null || !filtered[selectedIdx]) return null;
    const f = filtered[selectedIdx];
    const seg = f.segments[0];
    if (!seg || seg.length === 0) return null;
    const mid = seg[Math.floor(seg.length / 2)];
    const p = geoToMeshPos(mid[1], mid[0], bounds, terrain, exaggeration, meshWidth, meshHeight);
    if (!p) return null;
    return { x: p[0], y: p[1] + 0.15, z: p[2], name: f.name, type: f.type, width: f.width };
  }, [selectedIdx, filtered, bounds, meshWidth, meshHeight, terrain, exaggeration]);

  // Build a bright fat-line overlay for the traced network
  const tracedLinesObject = useMemo(() => {
    if (tracedIdxs.size === 0) return null;
    const positions: number[] = [];
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const maxMeshHeight = 10 * (exaggeration / 100);

    for (const fi of tracedIdxs) {
      const f = features[fi];
      if (!f) continue;
      for (const seg of f.segments) {
        for (let i = 0; i < seg.length - 1; i++) {
          const lon1 = seg[i][0], lat1 = seg[i][1];
          const lon2 = seg[i + 1][0], lat2 = seg[i + 1][1];
          const nx1 = (lon1 - bounds.minLon) / (bounds.maxLon - bounds.minLon);
          const ny1 = (lat1 - bounds.minLat) / (bounds.maxLat - bounds.minLat);
          const nx2 = (lon2 - bounds.minLon) / (bounds.maxLon - bounds.minLon);
          const ny2 = (lat2 - bounds.minLat) / (bounds.maxLat - bounds.minLat);
          if (nx1 < 0 || nx1 > 1 || ny1 < 0 || ny1 > 1) continue;
          if (nx2 < 0 || nx2 > 1 || ny2 < 0 || ny2 > 1) continue;
          const x1 = (nx1 - 0.5) * meshWidth;
          const z1 = -((ny1 - 0.5) * meshHeight);
          const x2 = (nx2 - 0.5) * meshWidth;
          const z2 = -((ny2 - 0.5) * meshHeight);
          const px1 = Math.floor(nx1 * (terrain.width - 1));
          const py1 = Math.floor((1 - ny1) * (terrain.height - 1));
          const px2 = Math.floor(nx2 * (terrain.width - 1));
          const py2 = Math.floor((1 - ny2) * (terrain.height - 1));
          let e1 = terrain.elevations[py1 * terrain.width + px1] || terrain.minElevation;
          let e2 = terrain.elevations[py2 * terrain.width + px2] || terrain.minElevation;
          if (terrain.noDataValue !== null && e1 === terrain.noDataValue) e1 = terrain.minElevation;
          if (terrain.noDataValue !== null && e2 === terrain.noDataValue) e2 = terrain.minElevation;
          const y1 = ((e1 - terrain.minElevation) / elevRange) * maxMeshHeight + 0.06;
          const y2 = ((e2 - terrain.minElevation) / elevRange) * maxMeshHeight + 0.06;
          positions.push(x1, y1, z1, x2, y2, z2);
        }
      }
    }
    if (positions.length === 0) return null;

    const geo = new LineSegmentsGeometry();
    geo.setPositions(new Float32Array(positions));
    const mat = new LineMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 1.0,
      linewidth: 5,
      resolution: new THREE.Vector2(size.width, size.height),
    });
    const line = new LineSegments2(geo, mat);
    line.computeLineDistances();
    return line;
  }, [tracedIdxs, features, bounds, terrain, exaggeration, meshWidth, meshHeight, size.width, size.height]);

  // Dispose traced lines
  useEffect(() => {
    return () => {
      if (tracedLinesObject) {
        tracedLinesObject.geometry.dispose();
        (tracedLinesObject.material as LineMaterial).dispose();
      }
    };
  }, [tracedLinesObject]);

  if (!fatLinesObject && !lineGeometry) return null;

  return (
    <group>
      {fatLinesObject && (
        <primitive object={fatLinesObject} />
      )}
      {/* Invisible clickable lines for raycasting */}
      {lineGeometry && (
        <lineSegments geometry={lineGeometry} onClick={handleClick}>
          <lineBasicMaterial transparent opacity={0} depthWrite={false} />
        </lineSegments>
      )}

      {selectedLabel && (
        <group position={[selectedLabel.x, selectedLabel.y, selectedLabel.z]}>
          <Html center distanceFactor={10} style={{ pointerEvents: 'none' }}>
            <div style={{
              background: 'rgba(0,0,0,0.9)',
              color: '#fff',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              whiteSpace: 'nowrap',
              border: `2px solid ${TYPE_COLORS[selectedLabel.type] || TYPE_COLORS.default}`,
              textAlign: 'left',
            }}>
              <div style={{
                fontWeight: 700,
                fontSize: '13px',
                color: TYPE_COLORS[selectedLabel.type] || TYPE_COLORS.default,
                marginBottom: 2,
              }}>
                {selectedLabel.name || '(unnamed)'}
              </div>
              <div style={{ opacity: 0.7, fontSize: '10px' }}>
                Type: {selectedLabel.type}
                {selectedLabel.width && ` · Width: ${selectedLabel.width}m`}
              </div>
            </div>
          </Html>
        </group>
      )}
    </group>
  );
};

export default WaterwaysLayer;
