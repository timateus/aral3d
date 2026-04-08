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

const TYPE_LINE_WIDTH: Record<string, number> = {
  river: 2.5,
  canal: 1.8,
  stream: 1.2,
  drain: 0.8,
  ditch: 0.6,
  dam: 3,
  default: 1,
};

function geoToXZ(
  lon: number, lat: number,
  bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  meshW: number, meshH: number,
): [number, number] {
  const nx = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
  const ny = (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
  return [(nx - 0.5) * meshW, -(ny - 0.5) * meshH];
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

  // Build merged geometry for performance — one BufferGeometry with all line segments
  const lineGeometry = useMemo(() => {
    if (filtered.length === 0) return null;

    const positions: number[] = [];
    const colors: number[] = [];
    const featureIndices: number[] = []; // map vertex pair -> feature index for click

    const color = new THREE.Color();

    for (let fi = 0; fi < filtered.length; fi++) {
      const f = filtered[fi];
      const c = TYPE_COLORS[f.type] || TYPE_COLORS.default;
      color.set(c);

      for (const seg of f.segments) {
        for (let i = 0; i < seg.length - 1; i++) {
          const [x1, z1] = geoToXZ(seg[i][0], seg[i][1], bounds, meshWidth, meshHeight);
          const [x2, z2] = geoToXZ(seg[i + 1][0], seg[i + 1][1], bounds, meshWidth, meshHeight);
          positions.push(x1, 0.12, z1, x2, 0.12, z2);
          colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
          featureIndices.push(fi, fi);
        }
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    return { geom, featureIndices };
  }, [filtered, bounds, meshWidth, meshHeight]);

  // For click detection, find nearest feature to click point
  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    if (!lineGeometry || filtered.length === 0) return;

    const point = e.point;
    const px = point.x;
    const pz = point.z;

    // Find closest feature by checking midpoints of segments
    let bestDist = Infinity;
    let bestIdx = -1;

    for (let fi = 0; fi < filtered.length; fi++) {
      const f = filtered[fi];
      if (!f.name) continue; // skip unnamed for click
      for (const seg of f.segments) {
        // Check midpoint of each segment piece
        for (let i = 0; i < seg.length; i++) {
          const [x, z] = geoToXZ(seg[i][0], seg[i][1], bounds, meshWidth, meshHeight);
          const d = (x - px) ** 2 + (z - pz) ** 2;
          if (d < bestDist) {
            bestDist = d;
            bestIdx = fi;
          }
        }
      }
    }

    if (bestDist < 0.15 && bestIdx >= 0) {
      setSelectedIdx(prev => prev === bestIdx ? null : bestIdx);
    } else {
      setSelectedIdx(null);
    }
  }, [filtered, lineGeometry, bounds, meshWidth, meshHeight]);

  // Selected feature label position
  const selectedLabel = useMemo(() => {
    if (selectedIdx === null || !filtered[selectedIdx]) return null;
    const f = filtered[selectedIdx];
    if (!f.name) return null;
    // Use midpoint of first segment
    const seg = f.segments[0];
    if (!seg || seg.length === 0) return null;
    const mid = seg[Math.floor(seg.length / 2)];
    const [x, z] = geoToXZ(mid[0], mid[1], bounds, meshWidth, meshHeight);
    return { x, z, name: f.name, type: f.type, width: f.width };
  }, [selectedIdx, filtered, bounds, meshWidth, meshHeight]);

  if (!lineGeometry) return null;

  return (
    <group>
      {/* Invisible click plane */}
      <mesh
        position={[0, 0.12, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={handleClick}
        visible={false}
      >
        <planeGeometry args={[meshWidth, meshHeight]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>

      {/* All lines as LineSegments for performance */}
      <lineSegments geometry={lineGeometry.geom}>
        <lineBasicMaterial vertexColors transparent opacity={0.85} />
      </lineSegments>

      {/* Selected label */}
      {selectedLabel && (
        <group position={[selectedLabel.x, 0.35, selectedLabel.z]}>
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
                {selectedLabel.name}
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
