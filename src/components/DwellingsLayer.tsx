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

// Mirror of TerrainMesh height calc: z_surface = normalized * (exaggeration / 10)
function geoToSurface(
  lon: number, lat: number,
  terrain: TerrainData,
  meshW: number, meshH: number,
  exaggeration: number,
): [number, number, number] {
  const { width, height, elevations, minElevation, maxElevation, bounds, noDataValue } = terrain;
  const u = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
  const v = (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
  const px = Math.max(0, Math.min(width - 1, Math.floor(u * (width - 1))));
  const py = Math.max(0, Math.min(height - 1, Math.floor((1 - v) * (height - 1))));
  let elev = elevations[py * width + px];
  if (isNaN(elev) || (noDataValue !== null && elev === noDataValue) || elev <= -9999) elev = minElevation;
  const range = (maxElevation - minElevation) || 1;
  const normalized = (elev - minElevation) / range;
  const maxHeight = exaggeration / 10;
  const y = normalized * maxHeight;
  const x = (u - 0.5) * meshW;
  const z = -(v - 0.5) * meshH;
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
    type M = { key: string; dwelling: Dwelling; loc: DwellingLocation; pos: [number, number, number] };
    const flat: M[] = [];
    dwellings.forEach(d => {
      d.locations.forEach((loc, i) => {
        const key = `${d.type}-${i}`;
        const pos = geoToSurface(loc.lon, loc.lat, terrain, meshW, meshH, exaggeration);
        flat.push({ key, dwelling: d, loc, pos });
      });
    });
    return flat;
  }, [dwellings, terrain, exaggeration]);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {markers.map(({ key, dwelling, loc, pos }) => {
        const isSelected = selected === key;
        const pinH = 0.12;
        // pos is in mesh-local coords (X right, Y up after mesh rotation, but our group also rotates)
        // TerrainMesh is rotated -PI/2 around X — this group does the same so we share coords.
        // After that rotation, the mesh's z (height) becomes world Y.
        return (
          <group key={key} position={[pos[0], -pos[2], pos[1]]}>
            {/* Pin shaft sitting ON the surface */}
            <mesh position={[0, 0, pinH / 2]} castShadow>
              <coneGeometry args={[0.025, pinH, 10]} />
              <meshStandardMaterial color={dwelling.color} emissive={dwelling.color} emissiveIntensity={0.5} />
            </mesh>
            <mesh
              position={[0, 0, pinH + 0.03]}
              onClick={(e) => { e.stopPropagation(); setSelected(isSelected ? null : key); }}
              onPointerOver={(e) => { (e.object as any).scale.setScalar(1.4); document.body.style.cursor = 'pointer'; }}
              onPointerOut={(e) => { (e.object as any).scale.setScalar(1); document.body.style.cursor = 'default'; }}
            >
              <sphereGeometry args={[0.04, 16, 12]} />
              <meshStandardMaterial color={dwelling.color} emissive={dwelling.color} emissiveIntensity={0.7} />
            </mesh>

            {isSelected && (
              <Html center distanceFactor={7} position={[0, 0, pinH + 0.6]} style={{ pointerEvents: 'auto' }}>
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
