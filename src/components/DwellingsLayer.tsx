import { useEffect, useState, useMemo } from 'react';
import { Html } from '@react-three/drei';
import { TerrainData } from '@/lib/geotiff-loader';

interface DwellingLocation { name: string; lat: number; lon: number; }
interface Dwelling {
  type: string;
  subtitle: string;
  icon: string;
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

export default function DwellingsLayer({ terrain, exaggeration }: Props) {
  const [dwellings, setDwellings] = useState<Dwelling[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch('/data/dwellings.json').then(r => r.json()).then(setDwellings).catch(() => {});
  }, []);

  const meshW = 10;
  const meshH = 10 * (terrain.height / terrain.width);

  const markers = useMemo(() => {
    return dwellings.flatMap(d =>
      d.locations.map((loc, i) => ({
        key: `${d.type}-${i}`,
        dwelling: d,
        loc,
        pos: geoToMeshPos(loc.lon, loc.lat, terrain.bounds, terrain.width, terrain.height, terrain.elevations, meshW, meshH, exaggeration),
      }))
    );
  }, [dwellings, terrain, exaggeration]);

  return (
    <group>
      {markers.map(({ key, dwelling, loc, pos }) => {
        const isSelected = selected === key;
        return (
          <group key={key} position={pos}>
            <Html center distanceFactor={10} position={[0, 0.35, 0]} style={{ pointerEvents: 'auto' }}>
              <div
                onClick={(e) => { e.stopPropagation(); setSelected(isSelected ? null : key); }}
                style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
              >
                <div style={{
                  width: 32, height: 32,
                  borderRadius: '50%',
                  background: dwelling.color,
                  border: isSelected ? '2px solid #fff' : '1px solid rgba(0,0,0,0.4)',
                  boxShadow: isSelected
                    ? `0 0 14px ${dwelling.color}, 0 4px 12px rgba(0,0,0,0.6)`
                    : '0 3px 10px rgba(0,0,0,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, lineHeight: 1,
                  transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                  transition: 'transform 0.15s ease',
                }}>
                  {dwelling.icon}
                </div>
                <div style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: 10, fontWeight: 700, color: '#fff',
                  textShadow: '0 1px 4px rgba(0,0,0,0.95)',
                  whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {dwelling.type}
                </div>
                <div style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: 8, color: '#cfd8dc',
                  textShadow: '0 1px 3px rgba(0,0,0,0.95)',
                  whiteSpace: 'nowrap',
                }}>
                  {loc.name}
                </div>
              </div>
            </Html>

            {isSelected && (
              <Html center distanceFactor={7} position={[0, 1.2, 0]} style={{ pointerEvents: 'auto' }}>
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: 280,
                    background: 'rgba(13,17,23,0.97)',
                    border: `1px solid ${dwelling.color}55`,
                    fontFamily: "'Inter', system-ui, sans-serif",
                    color: '#e6edf3',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: dwelling.color, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    }}>{dwelling.icon}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{dwelling.type}</div>
                      <div style={{ fontSize: 10, color: '#9aa4ad', fontStyle: 'italic' }}>{dwelling.subtitle}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, lineHeight: 1.5, color: '#c9d1d9', marginBottom: 8 }}>
                    {dwelling.description}
                  </div>
                  <div style={{
                    fontSize: 10, color: '#8b949e',
                    paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <div style={{ marginBottom: 3 }}>
                      <span style={{ color: dwelling.color, fontWeight: 600 }}>📍 Места: </span>
                      {dwelling.places}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 10, color: '#7d8590' }}>
                      Здесь: <span style={{ color: '#fff' }}>{loc.name}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    style={{
                      marginTop: 10, width: '100%',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#8b949e', fontSize: 10, padding: '4px 0', cursor: 'pointer',
                    }}
                  >Закрыть</button>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
