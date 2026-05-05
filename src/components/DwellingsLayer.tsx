import { useEffect, useState, useMemo } from 'react';
import { Html } from '@react-three/drei';
import { TerrainData } from '@/lib/geotiff-loader';
import * as THREE from 'three';

interface DwellingLocation { name: string; lat: number; lon: number; }
interface Dwelling {
  type: string;
  subtitle: string;
  color: string;
  description: string;
  places: string;
  locations: DwellingLocation[];
}

interface Props {
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
  const px = Math.max(0, Math.min(width - 1, Math.floor(u * (width - 1))));
  const py = Math.max(0, Math.min(height - 1, Math.floor((1 - v) * (height - 1))));
  const idx = py * width + px;
  const elev = elevations[idx] ?? 0;
  const x = (u - 0.5) * meshW;
  const z = -(v - 0.5) * meshH;
  const y = (elev / 800) * exaggeration;
  return [x, y, z];
}

function useIsMirage() {
  const [isMirage, setIsMirage] = useState(
    typeof document !== 'undefined' && document.documentElement.classList.contains('mirage')
  );
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsMirage(document.documentElement.classList.contains('mirage'));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return isMirage;
}

export default function DwellingsLayer({ terrain, exaggeration }: Props) {
  const [dwellings, setDwellings] = useState<Dwelling[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const isMirage = useIsMirage();

  useEffect(() => {
    fetch('/data/dwellings.json').then(r => r.json()).then(setDwellings).catch(() => {});
  }, []);

  const meshW = 10;
  const meshH = 10 * (terrain.height / terrain.width);

  const markers = useMemo(() => {
    type M = { key: string; dwelling: Dwelling; loc: DwellingLocation; pos: [number, number, number]; labelY: number };
    const flat: M[] = [];
    // Group by rounded coordinates to detect overlaps (precision ~ ~0.01°)
    const buckets = new Map<string, number>();
    dwellings.forEach(d => {
      d.locations.forEach((loc, i) => {
        const key = `${d.type}-${i}`;
        const pos = geoToMeshPos(loc.lon, loc.lat, terrain.bounds, terrain.width, terrain.height, terrain.elevations, meshW, meshH, exaggeration);
        const bucketKey = `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}`;
        const stackIdx = buckets.get(bucketKey) ?? 0;
        buckets.set(bucketKey, stackIdx + 1);
        // Stack labels vertically when multiple share a spot
        const labelY = 0.18 + stackIdx * 0.32;
        flat.push({ key, dwelling: d, loc, pos, labelY });
      });
    });
    return flat;
  }, [dwellings, terrain, exaggeration]);

  return (
    <group>
      {markers.map(({ key, dwelling, loc, pos, labelY }) => {
        const isSelected = selected === key;
        const pinHeight = 0.14;
        return (
          <group key={key} position={pos}>
            {/* Pin sitting ON the surface */}
            <mesh position={[0, pinHeight / 2, 0]} castShadow>
              <coneGeometry args={[0.04, pinHeight, 12]} />
              <meshStandardMaterial color={dwelling.color} emissive={dwelling.color} emissiveIntensity={0.4} />
            </mesh>
            <mesh position={[0, pinHeight + 0.035, 0]}>
              <sphereGeometry args={[0.045, 16, 12]} />
              <meshStandardMaterial color={dwelling.color} emissive={dwelling.color} emissiveIntensity={0.6} />
            </mesh>

            {/* Label stacked above pin (offset to avoid overlap with co-located pins) */}
            <Html center distanceFactor={10} position={[0, pinHeight + 0.1 + labelY, 0]} style={{ pointerEvents: 'auto' }}>
              <div
                onClick={(e) => { e.stopPropagation(); setSelected(isSelected ? null : key); }}
                style={{
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '3px 7px',
                  background: isSelected ? `${dwelling.color}` : 'rgba(13,17,23,0.78)',
                  border: `1px solid ${dwelling.color}`,
                  fontFamily: "'Inter', system-ui, sans-serif",
                  whiteSpace: 'nowrap',
                  transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                  transition: 'transform 0.15s ease',
                }}
              >
                <div style={{
                  fontSize: 10, fontWeight: 700,
                  color: isSelected ? '#0d1117' : '#fff',
                  letterSpacing: '0.02em',
                }}>{dwelling.type}</div>
                <div style={{
                  fontSize: 8,
                  color: isSelected ? '#0d1117' : '#cfd8dc',
                  marginTop: 1,
                }}>{loc.name}</div>
              </div>
            </Html>

            {isSelected && (
              <Html center distanceFactor={7} position={[0, pinHeight + 0.1 + labelY + 1.1, 0]} style={{ pointerEvents: 'auto' }}>
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: 280,
                    background: isMirage ? 'rgba(255,255,255,0.97)' : 'rgba(13,17,23,0.97)',
                    border: `1px solid ${dwelling.color}`,
                    fontFamily: "'Inter', system-ui, sans-serif",
                    color: isMirage ? '#0d1117' : '#e6edf3',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 12, height: 12, background: dwelling.color, display: 'inline-block' }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: isMirage ? '#0d1117' : '#fff' }}>{dwelling.type}</div>
                      <div style={{ fontSize: 10, color: isMirage ? '#5a6470' : '#9aa4ad', fontStyle: 'italic' }}>{dwelling.subtitle}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, lineHeight: 1.5, color: isMirage ? '#1c2128' : '#c9d1d9', marginBottom: 8 }}>
                    {dwelling.description}
                  </div>
                  <div style={{
                    fontSize: 10, color: isMirage ? '#5a6470' : '#8b949e',
                    paddingTop: 6, borderTop: isMirage ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <div style={{ marginBottom: 3 }}>
                      <span style={{ color: dwelling.color, fontWeight: 600 }}>Places: </span>
                      {dwelling.places}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      Here: <span style={{ color: isMirage ? '#0d1117' : '#fff' }}>{loc.name}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    style={{
                      marginTop: 10, width: '100%',
                      background: isMirage ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)',
                      border: isMirage ? '1px solid rgba(0,0,0,0.15)' : '1px solid rgba(255,255,255,0.12)',
                      color: isMirage ? '#1c2128' : '#8b949e',
                      fontSize: 10, padding: '4px 0', cursor: 'pointer',
                    }}
                  >Close</button>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
