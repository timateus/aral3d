import { useEffect, useState, useMemo } from 'react';
import { Html } from '@react-three/drei';
import { TerrainData } from '@/lib/geotiff-loader';
import * as THREE from 'three';

interface SchoolRecord {
  name: string;
  lat: number;
  lon: number;
  district: string;
  students: number | null;
  highSchoolers: number | null;
  waterSource: string;
  borehole: string;
  electricity: string;
  tds: number | null;
  notes: string;
}

interface SchoolsLayerProps {
  terrain: TerrainData;
  exaggeration: number;
}

function geoToMeshPos(
  lon: number, lat: number,
  bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  width: number, height: number,
  elevations: Float32Array,
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

function tdsColor(tds: number | null): string {
  if (tds === null) return '#60a5fa'; // blue-400
  if (tds < 300) return '#22c55e';   // green — good
  if (tds < 700) return '#eab308';   // yellow — ok
  if (tds < 1500) return '#f97316';  // orange — bad
  return '#ef4444';                   // red — very bad
}

function tdsLabel(tds: number | null): string {
  if (tds === null) return 'No data';
  if (tds < 300) return 'Good';
  if (tds < 700) return 'Acceptable';
  if (tds < 1500) return 'Poor';
  return 'Very poor';
}

export default function SchoolsLayer({ terrain, exaggeration }: SchoolsLayerProps) {
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    fetch('/data/schools.json')
      .then(r => r.json())
      .then(setSchools)
      .catch(() => {});
  }, []);

  const meshW = 10;
  const meshH = 10 * (terrain.height / terrain.width);

  const markers = useMemo(() => {
    if (!schools.length) return [];
    return schools.map((s) => {
      const pos = geoToMeshPos(
        s.lon, s.lat,
        terrain.bounds,
        terrain.width, terrain.height,
        terrain.elevations,
        meshW, meshH,
        exaggeration,
      );
      return { ...s, pos: pos as [number, number, number] };
    });
  }, [schools, terrain, exaggeration]);

  return (
    <group>
      {markers.map((m, i) => {
        const color = tdsColor(m.tds);
        const isSelected = selected === i;
        return (
          <group key={i} position={m.pos}>
            {/* Pin body */}
            <mesh
              position={[0, 0.25, 0]}
              onClick={(e) => { e.stopPropagation(); setSelected(isSelected ? null : i); }}
              onPointerOver={(e) => { e.stopPropagation(); (e.object as THREE.Mesh).scale.set(1.3, 1.3, 1.3); }}
              onPointerOut={(e) => { (e.object as THREE.Mesh).scale.set(1, 1, 1); }}
            >
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
            </mesh>
            {/* Pin stem */}
            <mesh position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.2, 6]} />
              <meshStandardMaterial color="#ffffff" opacity={0.7} transparent />
            </mesh>

            {/* Label */}
            {isSelected && (
              <Html center distanceFactor={8} position={[0, 0.55, 0]} style={{ pointerEvents: 'auto' }}>
                <div
                  style={{
                    background: 'rgba(13,17,23,0.95)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    padding: '10px 14px',
                    minWidth: '200px',
                    maxWidth: '280px',
                    fontFamily: "'Inter', system-ui, sans-serif",
                    color: '#e6edf3',
                    fontSize: '11px',
                    lineHeight: '1.5',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: 6, color: '#fff' }}>
                    {m.name}
                  </div>
                  <div style={{ color: '#8b949e', marginBottom: 4 }}>{m.district}</div>

                  {(m.students || m.highSchoolers) && (
                    <div style={{ marginBottom: 4 }}>
                      {m.students && <span>👨‍🎓 {m.students} students</span>}
                      {m.highSchoolers && <span style={{ marginLeft: 8 }}>📚 {m.highSchoolers} senior</span>}
                    </div>
                  )}

                  <div style={{ marginBottom: 4 }}>
                    💧 <span style={{ color: '#8b949e' }}>Water:</span> {m.waterSource}
                  </div>

                  <div style={{ marginBottom: 4 }}>
                    🔩 <span style={{ color: '#8b949e' }}>Borehole:</span> {m.borehole}
                  </div>

                  <div style={{ marginBottom: 4 }}>
                    ⚡ <span style={{ color: '#8b949e' }}>Electricity:</span> {m.electricity}
                  </div>

                  {m.tds !== null && (
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ color: color, fontWeight: 600 }}>
                        TDS: {m.tds} ppm
                      </span>
                      <span style={{ color: '#8b949e', marginLeft: 6 }}>({tdsLabel(m.tds)})</span>
                    </div>
                  )}

                  {m.notes && (
                    <div style={{ color: '#8b949e', fontStyle: 'italic', marginTop: 4, fontSize: '10px' }}>
                      {m.notes}
                    </div>
                  )}

                  <button
                    onClick={() => setSelected(null)}
                    style={{
                      marginTop: 8,
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#8b949e',
                      padding: '2px 10px',
                      fontSize: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
