import { useEffect, useState, useMemo } from 'react';
import { Html } from '@react-three/drei';
import { TerrainData } from '@/lib/geotiff-loader';
import * as THREE from 'three';

interface VocabItem {
  term: string;
  description: string;
  location: string;
  category: string;
  lat: number;
  lon: number;
  image: string;
}

interface VocabularyLayerProps {
  terrain: TerrainData;
  exaggeration: number;
}

function geoToMeshPos(
  lon: number, lat: number,
  bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  width: number, height: number,
  elevations: Float32Array | Float64Array,
  meshW: number, meshH: number,
  exaggeration: number,
): [number, number, number] {
  const u = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
  const v = (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
  const px = Math.floor(u * (width - 1));
  const py = Math.floor((1 - v) * (height - 1));
  const idx = py * width + px;
  const elev = elevations[idx] ?? 0;
  const x = (u - 0.5) * meshW;
  const z = -(v - 0.5) * meshH;
  const y = (elev / 800) * exaggeration;
  return [x, y, z];
}

const CATEGORY_COLORS: Record<string, string> = {
  'Land and Water': '#4fc3f7',
  'Tools': '#ffb74d',
  'People': '#ce93d8',
  'Territories': '#a5d6a7',
};

export default function VocabularyLayer({ terrain, exaggeration }: VocabularyLayerProps) {
  const [items, setItems] = useState<VocabItem[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    fetch('/data/vocabulary.json')
      .then(r => r.json())
      .then(setItems)
      .catch(() => {});
  }, []);

  const meshW = 10;
  const meshH = 10 * (terrain.height / terrain.width);

  const markers = useMemo(() => {
    if (!items.length) return [];
    return items.map((item) => {
      const pos = geoToMeshPos(
        item.lon, item.lat,
        terrain.bounds,
        terrain.width, terrain.height,
        terrain.elevations,
        meshW, meshH,
        exaggeration,
      );
      return { ...item, pos: pos as [number, number, number] };
    });
  }, [items, terrain, exaggeration]);

  return (
    <group>
      {markers.map((m, i) => {
        const color = CATEGORY_COLORS[m.category] || '#90caf9';
        const isSelected = selected === i;
        return (
          <group key={i} position={m.pos}>
            {/* Floating photo thumbnail */}
            <Html center distanceFactor={10} position={[0, 0.4, 0]} style={{ pointerEvents: 'auto' }}>
              <div
                onClick={(e) => { e.stopPropagation(); setSelected(isSelected ? null : i); }}
                style={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease',
                  transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                }}
                onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.12)'; }}
                onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }}
              >
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  border: isSelected ? `2px solid ${color}` : '2px solid rgba(255,255,255,0.3)',
                  boxShadow: isSelected
                    ? `0 0 12px ${color}88, 0 4px 16px rgba(0,0,0,0.6)`
                    : '0 4px 12px rgba(0,0,0,0.5)',
                }}>
                  <img
                    src={m.image}
                    alt={m.term}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    draggable={false}
                  />
                </div>
                <div style={{
                  textAlign: 'center',
                  marginTop: '2px',
                  fontSize: '9px',
                  fontWeight: 600,
                  color: '#fff',
                  textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontStyle: 'italic',
                  maxWidth: '70px',
                  lineHeight: 1.2,
                }}>
                  {m.term}
                </div>
              </div>
            </Html>

            {/* Expanded card on click */}
            {isSelected && (
              <Html center distanceFactor={8} position={[0, 1.2, 0]} style={{ pointerEvents: 'auto' }}>
                <div
                  style={{
                    background: 'rgba(13,17,23,0.96)',
                    border: `1px solid ${color}33`,
                    width: '240px',
                    fontFamily: "'Inter', system-ui, sans-serif",
                    color: '#e6edf3',
                    fontSize: '11px',
                    lineHeight: '1.5',
                    overflow: 'hidden',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ width: '100%', height: '140px', overflow: 'hidden' }}>
                    <img src={m.image} alt={m.term} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff', fontStyle: 'italic', marginBottom: 2 }}>
                      {m.term}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ color: '#8b949e', fontSize: '10px' }}>📍 {m.location}</span>
                      <span style={{ fontSize: '9px', padding: '1px 6px', background: `${color}22`, color, border: `1px solid ${color}44` }}>
                        {m.category}
                      </span>
                    </div>
                    <div style={{ color: '#c9d1d9', fontSize: '11px', lineHeight: 1.5 }}>
                      {m.description}
                    </div>
                    <button
                      onClick={() => setSelected(null)}
                      style={{
                        marginTop: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                        color: '#8b949e', padding: '2px 10px', fontSize: '10px', cursor: 'pointer', width: '100%',
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
