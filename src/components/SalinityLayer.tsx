import { useEffect, useState, useMemo, useCallback } from 'react';
import { TerrainData } from '@/lib/geotiff-loader';
import * as shapefile from 'shapefile';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import JSZip from 'jszip';

interface SalinityLayerProps {
  terrain: TerrainData;
  exaggeration: number;
}

interface SalFeature {
  rings: number[][][];
  properties: Record<string, any>;
}

const MAX_EXTRUDE = 1.5;

function salinityColor(t: number): string {
  // Bubble gum palette: pink → magenta → hot pink → violet
  if (t < 0.25) {
    const s = t / 0.25;
    const r = 255, g = Math.round(200 - s * 50), b = Math.round(210 + s * 30);
    return `rgb(${r},${g},${b})`;
  }
  if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    const r = Math.round(255 - s * 20), g = Math.round(150 - s * 60), b = Math.round(240 - s * 30);
    return `rgb(${r},${g},${b})`;
  }
  if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    const r = Math.round(235 - s * 35), g = Math.round(90 - s * 30), b = Math.round(210 + s * 20);
    return `rgb(${r},${g},${b})`;
  }
  const s = (t - 0.75) / 0.25;
  const r = Math.round(200 - s * 40), g = Math.round(60 - s * 20), b = Math.round(230 - s * 10);
  return `rgb(${r},${g},${b})`;
}

function geoToMeshPos(
  lon: number, lat: number,
  tb: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  meshW: number, meshH: number,
): [number, number, number] {
  const nx = (lon - tb.minLon) / (tb.maxLon - tb.minLon);
  const ny = (lat - tb.minLat) / (tb.maxLat - tb.minLat);
  return [(nx - 0.5) * meshW, 0.02, -(ny - 0.5) * meshH];
}

function centroid(ring: number[][]): [number, number] {
  let cx = 0, cy = 0;
  for (const [x, y] of ring) { cx += x; cy += y; }
  return [cx / ring.length, cy / ring.length];
}

function fanTriangulate(ring: number[][], converter: (lon: number, lat: number) => [number, number, number]): number[] {
  const pts = ring.map(([lon, lat]) => converter(lon, lat));
  if (pts.length < 3) return [];
  const verts: number[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    verts.push(...pts[0], ...pts[i], ...pts[i + 1]);
  }
  return verts;
}

function buildSideWalls(ring: number[][], converter: (lon: number, lat: number) => [number, number, number], offset: number): number[] {
  const pts = ring.map(([lon, lat]) => converter(lon, lat));
  if (pts.length < 2) return [];
  const verts: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay, az] = pts[i];
    const [bx, by, bz] = pts[i + 1];
    verts.push(ax, ay, az, bx, by, bz, bx, by + offset, bz);
    verts.push(ax, ay, az, bx, by + offset, bz, ax, ay + offset, az);
  }
  return verts;
}

interface RegionMesh {
  key: string;
  name: string;
  value: number;
  valueKey: string;
  color: string;
  topVerts: Float32Array;
  sideVerts: Float32Array | null;
  borderVerts: Float32Array;
  labelPos: [number, number, number];
  height: number;
}

async function extractShapefilesFromZip(zipBuf: ArrayBuffer): Promise<{ shp: ArrayBuffer; dbf: ArrayBuffer } | null> {
  const zip = await JSZip.loadAsync(zipBuf);
  
  // Check for nested zip
  const zipFiles = Object.keys(zip.files).filter(n => n.endsWith('.zip'));
  let targetZip = zip;
  
  if (zipFiles.length > 0 && !Object.keys(zip.files).some(n => n.endsWith('.shp'))) {
    // Extract inner zip
    const innerBuf = await zip.files[zipFiles[0]].async('arraybuffer');
    targetZip = await JSZip.loadAsync(innerBuf);
  }
  
  const files = Object.keys(targetZip.files);
  const shpFile = files.find(f => f.toLowerCase().endsWith('.shp'));
  const dbfFile = files.find(f => f.toLowerCase().endsWith('.dbf'));
  
  if (!shpFile || !dbfFile) {
    console.warn('No .shp/.dbf found in zip. Files:', files);
    return null;
  }
  
  const [shp, dbf] = await Promise.all([
    targetZip.files[shpFile].async('arraybuffer'),
    targetZip.files[dbfFile].async('arraybuffer'),
  ]);
  
  return { shp, dbf };
}

const SalinityLayer = ({ terrain, exaggeration }: SalinityLayerProps) => {
  const [features, setFeatures] = useState<SalFeature[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const zipBuf = await fetch('/data/salinity.zip').then(r => r.arrayBuffer());
        const extracted = await extractShapefilesFromZip(zipBuf);
        if (!extracted) return;
        
        const source = await shapefile.open(extracted.shp, extracted.dbf);
        const feats: SalFeature[] = [];
        let result = await source.read();
        while (!result.done) {
          const f = result.value;
          if (f.geometry) {
            let rings: number[][][] = [];
            if (f.geometry.type === 'Polygon') {
              rings = [f.geometry.coordinates[0]];
            } else if (f.geometry.type === 'MultiPolygon') {
              rings = f.geometry.coordinates.map((p: number[][][]) => p[0]);
            } else if (f.geometry.type === 'Point') {
              // Skip points for now, we want polygons
            }
            if (rings.length > 0) {
              feats.push({ rings, properties: f.properties || {} });
            }
          }
          result = await source.read();
        }
        console.log('Salinity features loaded:', feats.length, feats[0]?.properties);
        setFeatures(feats);
      } catch (e) {
        console.warn('Salinity zip load failed:', e);
      }
    })();
  }, []);

  const meshWidth = 10;
  const meshHeight = 10 * (terrain.height / terrain.width);
  const safeBounds = terrain.bounds || { minLon: 56, maxLon: 62, minLat: 42, maxLat: 47 };

  const converter = useCallback((lon: number, lat: number) =>
    geoToMeshPos(lon, lat, safeBounds, meshWidth, meshHeight),
    [safeBounds, meshWidth, meshHeight]
  );

  const { regions, valueKey } = useMemo(() => {
    if (!features.length) return { regions: [], valueKey: '' };

    const props0 = features[0].properties;
    let vKey = '';
    for (const k of Object.keys(props0)) {
      if (typeof props0[k] === 'number' && !k.toLowerCase().includes('id') && !k.toLowerCase().includes('fid') && !k.toLowerCase().includes('objectid')) {
        vKey = k; break;
      }
    }
    if (!vKey) {
      for (const k of Object.keys(props0)) {
        if (typeof props0[k] === 'number') { vKey = k; break; }
      }
    }

    let mn = Infinity, mx = -Infinity;
    for (const f of features) {
      const v = vKey ? (f.properties[vKey] as number) : 0;
      if (isFinite(v) && v > 0) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
    }
    if (mn === mx) mx = mn + 1;
    if (!isFinite(mn)) mn = 0;
    const range = mx - mn;

    const result: RegionMesh[] = [];
    for (let i = 0; i < features.length; i++) {
      const feat = features[i];
      const v = vKey ? (feat.properties[vKey] as number) : 0;
      if (!isFinite(v) || v <= 0) continue;

      const t = (v - mn) / range;
      const height = Math.sqrt(t) * MAX_EXTRUDE;
      const color = salinityColor(t);
      const name = feat.properties['name'] || feat.properties['NAME'] || feat.properties['ab_doff'] || `Zone ${i + 1}`;

      const allTopVerts: number[] = [];
      const allSideVerts: number[] = [];
      const allBorderVerts: number[] = [];

      for (const ring of feat.rings) {
        const topConverter = (lon: number, lat: number) => {
          const p = converter(lon, lat);
          return [p[0], p[1] + height, p[2]] as [number, number, number];
        };
        allTopVerts.push(...fanTriangulate(ring, topConverter));
        if (height > 0.01) {
          allSideVerts.push(...buildSideWalls(ring, converter, height));
        }
        const borderPts = ring.map(([lon, lat]: number[]) => {
          const p = converter(lon, lat);
          return [p[0], p[1] + height + 0.01, p[2]] as [number, number, number];
        });
        for (const pt of borderPts) allBorderVerts.push(...pt);
      }

      if (allTopVerts.length === 0) continue;

      const [clon, clat] = centroid(feat.rings[0]);
      const labelP = converter(clon, clat);

      result.push({
        key: `sal-${i}`,
        name: String(name),
        value: v,
        valueKey: vKey,
        color,
        topVerts: new Float32Array(allTopVerts),
        sideVerts: allSideVerts.length > 0 ? new Float32Array(allSideVerts) : null,
        borderVerts: new Float32Array(allBorderVerts),
        labelPos: [labelP[0], labelP[1] + height + 0.15, labelP[2]],
        height,
      });
    }

    return { regions: result, valueKey: vKey };
  }, [features, converter]);

  const handleClick = useCallback((key: string) => {
    setSelected(prev => prev === key ? null : key);
  }, []);

  if (!regions.length) return null;

  return (
    <group>
      {regions.map(r => (
        <group key={r.key}>
          <mesh onClick={() => handleClick(r.key)}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[r.topVerts, 3]} />
            </bufferGeometry>
            <meshStandardMaterial color={r.color} transparent opacity={0.85} side={THREE.DoubleSide} />
          </mesh>

          {r.sideVerts && (
            <mesh>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[r.sideVerts, 3]} />
              </bufferGeometry>
              <meshStandardMaterial color={r.color} transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
          )}

          <line>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[r.borderVerts, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color="#ffffff" transparent opacity={0.4} />
          </line>

          {selected === r.key && (
            <group position={r.labelPos}>
              <Html center distanceFactor={10} style={{ pointerEvents: 'none' }}>
                <div style={{
                  background: 'rgba(0,0,0,0.85)',
                  color: '#fff',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  whiteSpace: 'nowrap',
                  border: `1px solid ${r.color}`,
                }}>
                  <div style={{ fontWeight: 600, color: r.color }}>{r.name}</div>
                  <div style={{ marginTop: 2, fontWeight: 700 }}>
                    {r.valueKey}: {r.value.toLocaleString()}
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

export default SalinityLayer;
