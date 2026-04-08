import { useMemo, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { TerrainData } from '@/lib/geotiff-loader';
import {
  ENVIRONMENTAL_ISSUES,
  getSeverityAtYear,
  severityColor,
  EnvironmentalIssue,
} from '@/lib/environmental-issues-data';

interface EnvironmentalIssuesLayerProps {
  terrain: TerrainData;
  exaggeration: number;
  year: number;
}

function geoToMeshPos(
  lon: number, lat: number,
  tb: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  meshW: number, meshH: number,
): [number, number, number] {
  const nx = (lon - tb.minLon) / (tb.maxLon - tb.minLon);
  const ny = (lat - tb.minLat) / (tb.maxLat - tb.minLat);
  const x = (nx - 0.5) * meshW;
  const z = -(ny - 0.5) * meshH;
  return [x, 0.15, z];
}

interface MarkerData {
  issue: EnvironmentalIssue;
  pos: [number, number, number];
  severity: number;
  color: string;
  radius: number;
  height: number;
}

const EnvironmentalIssuesLayer = ({ terrain, exaggeration, year }: EnvironmentalIssuesLayerProps) => {
  const [selected, setSelected] = useState<string | null>(null);

  const meshWidth = 10;
  const meshHeight = 10 * (terrain.height / terrain.width);
  const bounds = terrain.bounds || { minLon: 56, maxLon: 62, minLat: 42, maxLat: 47 };

  const markers = useMemo<MarkerData[]>(() => {
    return ENVIRONMENTAL_ISSUES.map(issue => {
      const severity = getSeverityAtYear(issue, year);
      const color = severityColor(severity);
      const pos = geoToMeshPos(issue.lon, issue.lat, bounds, meshWidth, meshHeight);
      const radius = 0.04 + severity * 0.12;
      const height = 0.1 + severity * 0.8;
      // Raise marker above terrain
      pos[1] = 0.15 + height / 2;
      return { issue, pos, severity, color, radius, height };
    });
  }, [year, bounds, meshWidth, meshHeight]);

  const handleClick = useCallback((id: string) => {
    setSelected(prev => prev === id ? null : id);
  }, []);

  const impactBadge = (level: string) => {
    const colors: Record<string, string> = {
      critical: '#ff4444',
      high: '#ff8800',
      medium: '#ffcc00',
    };
    return colors[level] || '#888';
  };

  return (
    <group>
      {markers.map(m => (
        <group key={m.issue.id}>
          {/* Vertical stem */}
          <mesh
            position={[m.pos[0], m.height / 2, m.pos[2]]}
            onClick={(e) => { e.stopPropagation(); handleClick(m.issue.id); }}
          >
            <cylinderGeometry args={[0.015, 0.015, m.height, 6]} />
            <meshStandardMaterial color={m.color} transparent opacity={0.7} />
          </mesh>

          {/* Top sphere */}
          <mesh
            position={[m.pos[0], m.height + 0.05, m.pos[2]]}
            onClick={(e) => { e.stopPropagation(); handleClick(m.issue.id); }}
          >
            <sphereGeometry args={[m.radius, 12, 8]} />
            <meshStandardMaterial
              color={m.color}
              transparent
              opacity={0.85}
              emissive={new THREE.Color(m.color)}
              emissiveIntensity={0.3}
            />
          </mesh>

          {/* Pulsing ring at base */}
          {m.severity > 0.3 && (
            <mesh
              position={[m.pos[0], 0.05, m.pos[2]]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <ringGeometry args={[m.radius * 1.5, m.radius * 2.2, 24]} />
              <meshBasicMaterial
                color={m.color}
                transparent
                opacity={0.25}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}

          {/* Emoji label always visible */}
          <group position={[m.pos[0], m.height + m.radius + 0.12, m.pos[2]]}>
            <Html center distanceFactor={10} style={{ pointerEvents: 'none' }}>
              <div style={{
                fontSize: '16px',
                textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                lineHeight: 1,
              }}>
                {m.issue.emoji}
              </div>
            </Html>
          </group>

          {/* Info popup when selected */}
          {selected === m.issue.id && (
            <group position={[m.pos[0], m.height + m.radius + 0.4, m.pos[2]]}>
              <Html center distanceFactor={10} style={{ pointerEvents: 'none' }}>
                <div style={{
                  background: 'rgba(0,0,0,0.92)',
                  color: '#fff',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  whiteSpace: 'nowrap',
                  border: `2px solid ${m.color}`,
                  minWidth: '180px',
                  textAlign: 'left',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: m.color, marginBottom: 4 }}>
                    {m.issue.emoji} {m.issue.category}
                  </div>
                  <div style={{ opacity: 0.7, fontSize: '10px', marginBottom: 4 }}>
                    📍 {m.issue.location}
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginBottom: 4,
                  }}>
                    <div>
                      <div style={{ opacity: 0.5, fontSize: '9px' }}>Before 1960</div>
                      <div style={{ fontSize: '10px', color: '#66cc66' }}>{m.issue.descBefore}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ opacity: 0.5, fontSize: '9px' }}>{year}</div>
                      <div style={{ fontSize: '10px', color: m.color }}>{m.issue.descAfter}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '10px' }}>
                      Severity: <span style={{ fontWeight: 700, color: m.color }}>{Math.round(m.severity * 100)}%</span>
                    </div>
                    <div style={{
                      fontSize: '9px',
                      padding: '1px 6px',
                      borderRadius: '3px',
                      background: impactBadge(m.issue.impactLevel),
                      color: '#000',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}>
                      {m.issue.impactLevel}
                    </div>
                  </div>
                </div>
              </Html>
            </group>
          )}
        </group>
      ))}
    </group>
  );
};

export default EnvironmentalIssuesLayer;
