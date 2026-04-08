import { useEffect, useMemo, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { TerrainData } from '@/lib/geotiff-loader';

export type WaterwayTypeFilter = 'all' | 'canal' | 'river' | 'stream' | 'drain' | 'ditch' | 'dam';

interface WaterwayFeature {
  name: string | null;
  type: string;
  width: number | null;
  segments: [number, number][][]; // array of line strings, each is array of [lon, lat]
}

interface WaterwaysLayerProps {
  terrain: TerrainData;
  exaggeration: number;
  typeFilter: WaterwayTypeFilter;
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

/** Sample terrain elevation at a geo coordinate and return [x, y, z] in mesh space */
function geoToMeshPos(
  lon: number, lat: number,
  bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  meshW: number, meshH: number,
  terrain: TerrainData,
  exaggeration: number,
): [number, number, number] {
  const nx = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
  const ny = (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
  const x = (nx - 0.5) * meshW;
  const z = -(ny - 0.5) * meshH;

  // Sample elevation from terrain grid
  const col = Math.round(nx * (terrain.width - 1));
  const row = Math.round((1 - ny) * (terrain.height - 1));
  let y = 0.12; // fallback above flat plane
  if (col >= 0 && col < terrain.width && row >= 0 && row < terrain.height) {
    const elev = terrain.elevations[row * terrain.width + col];
    if (elev > -9000) {
      const scale = meshW / terrain.width;
      y = elev * scale * exaggeration + 0.03; // slight offset above terrain surface
    }
  }

  return [x, y, z];
}

const WaterwaysLayer = ({ terrain, exaggeration, typeFilter }: WaterwaysLayerProps) => {
  const [features, setFeatures] = useState<WaterwayFeature[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const meshWidth = 10;
  const meshHeight = 10 * (terrain.height / terrain.width);
  const bounds = terrain.bounds || { minLon: 56, maxLon: 62, minLat: 42, maxLat: 47 };

  useEffect(() => {
    fetch('/data/waterwaysRegion.geojson')
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
          parsed.push({
            name: props.name || null,
            type: props.type || 'unknown',
            width: props.width || null,
            segments,
          });
        }
        setFeatures(parsed);
      })
      .catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return features;
    return features.filter(f => f.type === typeFilter);
  }, [features, typeFilter]);

  // Build merged LineSegments geometry projected onto terrain
  const lineGeometry = useMemo(() => {
    if (filtered.length === 0) return null;

    const positions: number[] = [];
    const colors: number[] = [];
    const color = new THREE.Color();

    for (let fi = 0; fi < filtered.length; fi++) {
      const f = filtered[fi];
      const c = TYPE_COLORS[f.type] || TYPE_COLORS.default;
      color.set(c);

      for (const seg of f.segments) {
        for (let i = 0; i < seg.length - 1; i++) {
          const [x1, y1, z1] = geoToMeshPos(seg[i][0], seg[i][1], bounds, meshWidth, meshHeight, terrain, exaggeration);
          const [x2, y2, z2] = geoToMeshPos(seg[i + 1][0], seg[i + 1][1], bounds, meshWidth, meshHeight, terrain, exaggeration);
          positions.push(x1, y1, z1, x2, y2, z2);
          colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
        }
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    return geom;
  }, [filtered, bounds, meshWidth, meshHeight, terrain, exaggeration]);

  // Click handler: use raycasted point to find nearest named feature
  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    if (filtered.length === 0) return;

    const px = e.point.x;
    const py = e.point.y;
    const pz = e.point.z;

    let bestDist = Infinity;
    let bestIdx = -1;

    for (let fi = 0; fi < filtered.length; fi++) {
      const f = filtered[fi];
      for (const seg of f.segments) {
        // Sample every few vertices for perf
        const step = Math.max(1, Math.floor(seg.length / 20));
        for (let i = 0; i < seg.length; i += step) {
          const [x, y, z] = geoToMeshPos(seg[i][0], seg[i][1], bounds, meshWidth, meshHeight, terrain, exaggeration);
          const d = (x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2;
          if (d < bestDist) {
            bestDist = d;
            bestIdx = fi;
          }
        }
      }
    }

    if (bestDist < 0.25 && bestIdx >= 0) {
      setSelectedIdx(prev => prev === bestIdx ? null : bestIdx);
    } else {
      setSelectedIdx(null);
    }
  }, [filtered, bounds, meshWidth, meshHeight, terrain, exaggeration]);

  // Selected feature label position
  const selectedLabel = useMemo(() => {
    if (selectedIdx === null || !filtered[selectedIdx]) return null;
    const f = filtered[selectedIdx];
    const seg = f.segments[0];
    if (!seg || seg.length === 0) return null;
    const mid = seg[Math.floor(seg.length / 2)];
    const [x, y, z] = geoToMeshPos(mid[0], mid[1], bounds, meshWidth, meshHeight, terrain, exaggeration);
    return { x, y: y + 0.2, z, name: f.name, type: f.type, width: f.width };
  }, [selectedIdx, filtered, bounds, meshWidth, meshHeight, terrain, exaggeration]);

  if (!lineGeometry) return null;

  return (
    <group>
      {/* Invisible terrain-following click surface — use the terrain mesh itself via onClick on the lineSegments */}
      <lineSegments geometry={lineGeometry} onClick={handleClick}>
        <lineBasicMaterial vertexColors transparent opacity={0.9} />
      </lineSegments>

      {/* Selected label */}
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
