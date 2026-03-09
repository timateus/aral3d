import { useMemo, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { TerrainData } from '@/lib/geotiff-loader';
import { getSewageForDistrict, getSewageForRegion, sewageColor } from '@/lib/sewage-data';
import {
  INDICATORS,
  DemographicIndicator,
  CsvData,
  loadIndicatorData,
  lookupByShapeName,
  lookupByRegionName,
  regionHasDistrictData,
  getGlobalMax,
  getIndicatorColor,
  getIndicatorHeight,
} from '@/lib/demographic-data';

interface ChoroplethLayerProps {
  terrain: TerrainData;
  exaggeration: number;
  year: number;
  indicatorId?: string;
}

interface GeoJSONFeature {
  type: string;
  properties: Record<string, any>;
  geometry: { type: string; coordinates: any[] };
}

interface GeoJSONCollection {
  type: string;
  features: GeoJSONFeature[];
}

interface RegionMesh {
  key: string;
  nameEn: string;
  nameRu: string;
  value: number;
  unit: string;
  color: string;
  topVerts: Float32Array;
  sideVerts: Float32Array | null;
  borderVerts: Float32Array;
  labelPos: [number, number, number];
  height: number;
}

const MAX_EXTRUDE = 1.5;

function geoToMeshPos(
  lon: number, lat: number,
  bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  terrain: TerrainData, exaggeration: number,
  meshWidth: number, meshHeight: number,
): [number, number, number] | null {
  const nx = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
  const ny = (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);

  const x = (nx - 0.5) * meshWidth;
  const planeY = (ny - 0.5) * meshHeight;

  const col = Math.floor(nx * (terrain.width - 1));
  const row = Math.floor((1 - ny) * (terrain.height - 1));
  let elev = 0;
  if (row >= 0 && row < terrain.height && col >= 0 && col < terrain.width) {
    elev = terrain.elevations[row * terrain.width + col];
  }
  const y = (elev / (terrain.maxElevation - terrain.minElevation)) * exaggeration;

  return [x, y + 0.02, -planeY];
}

function centroid(ring: number[][]): [number, number] {
  let cx = 0, cy = 0;
  for (const [x, y] of ring) { cx += x; cy += y; }
  return [cx / ring.length, cy / ring.length];
}

function fanTriangulate(ring: number[][], converter: (lon: number, lat: number) => [number, number, number] | null): number[] {
  const pts = ring.map(([lon, lat]) => converter(lon, lat)).filter(Boolean) as [number, number, number][];
  if (pts.length < 3) return [];
  const verts: number[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    verts.push(...pts[0], ...pts[i], ...pts[i + 1]);
  }
  return verts;
}

function buildSideWalls(ring: number[][], converter: (lon: number, lat: number) => [number, number, number] | null, offset: number): number[] {
  const pts = ring.map(([lon, lat]) => converter(lon, lat)).filter(Boolean) as [number, number, number][];
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

function buildRegionMesh(
  rings: number[][][],
  converter: (lon: number, lat: number) => [number, number, number] | null,
  data: { value: number; nameEn: string; nameRu: string; color: string; height: number; unit: string },
  key: string,
): RegionMesh | null {
  const allTopVerts: number[] = [];
  const allSideVerts: number[] = [];
  const allBorderVerts: number[] = [];
  const extrudeH = data.height * MAX_EXTRUDE;

  for (const ring of rings) {
    const topConverter = (lon: number, lat: number) => {
      const p = converter(lon, lat);
      if (!p) return null;
      return [p[0], p[1] + extrudeH, p[2]] as [number, number, number];
    };
    allTopVerts.push(...fanTriangulate(ring, topConverter));

    if (extrudeH > 0.01) {
      allSideVerts.push(...buildSideWalls(ring, converter, extrudeH));
    }

    const borderPts = ring.map(([lon, lat]) => {
      const p = converter(lon, lat);
      return p ? [p[0], p[1] + extrudeH + 0.01, p[2]] : null;
    }).filter(Boolean) as [number, number, number][];
    for (const pt of borderPts) allBorderVerts.push(...pt);
  }

  if (allTopVerts.length === 0) return null;

  const mainRing = rings[0];
  const [clon, clat] = centroid(mainRing);
  const labelP = converter(clon, clat);
  const labelPos: [number, number, number] = labelP
    ? [labelP[0], labelP[1] + extrudeH + 0.15, labelP[2]]
    : [0, 0, 0];

  return {
    key,
    nameEn: data.nameEn,
    nameRu: data.nameRu,
    value: data.value,
    unit: data.unit,
    color: data.color,
    topVerts: new Float32Array(allTopVerts),
    sideVerts: allSideVerts.length > 0 ? new Float32Array(allSideVerts) : null,
    borderVerts: new Float32Array(allBorderVerts),
    labelPos,
    height: extrudeH,
  };
}

const ChoroplethLayer = ({ terrain, exaggeration, year, indicatorId = 'sewage' }: ChoroplethLayerProps) => {
  const [adm2Geo, setAdm2Geo] = useState<GeoJSONCollection | null>(null);
  const [adm1Geo, setAdm1Geo] = useState<GeoJSONCollection | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<CsvData | null>(null);

  const indicator = useMemo(() => INDICATORS.find(i => i.id === indicatorId) || INDICATORS[0], [indicatorId]);
  const isSewage = indicator.id === 'sewage';

  // Load GeoJSON files
  useEffect(() => {
    Promise.all([
      fetch('/data/uzb_adm2.geojson').then(r => r.json()),
      fetch('/data/uzb_adm1.geojson').then(r => r.json()),
    ]).then(([a2, a1]) => {
      setAdm2Geo(a2);
      setAdm1Geo(a1);
    });
  }, []);

  // Load CSV data for non-sewage indicators
  useEffect(() => {
    if (isSewage) {
      setCsvData(null);
      return;
    }
    loadIndicatorData(indicator).then(d => setCsvData(d));
  }, [indicator, isSewage]);

  const meshWidth = (terrain.width / Math.max(terrain.width, terrain.height)) * 10;
  const meshHeight = (terrain.height / Math.max(terrain.width, terrain.height)) * 10;
  const bounds = terrain.bounds;

  const converter = useCallback((lon: number, lat: number) =>
    geoToMeshPos(lon, lat, bounds, terrain, exaggeration, meshWidth, meshHeight),
    [bounds, terrain, exaggeration, meshWidth, meshHeight]
  );

  const regions = useMemo(() => {
    if (!adm2Geo || !adm1Geo) return [];
    if (!isSewage && !csvData) return [];

    const result: RegionMesh[] = [];
    const globalMax = csvData ? getGlobalMax(csvData) : 100;

    // Track which ADM1 regions have ADM2 district coverage
    const regionsWithDistricts = new Set<string>();

    // Helper to extract polygon rings from a feature
    const getRings = (feat: GeoJSONFeature): number[][][] => {
      const rings: number[][][] = [];
      if (feat.geometry.type === 'Polygon') {
        rings.push(feat.geometry.coordinates[0]);
      } else if (feat.geometry.type === 'MultiPolygon') {
        for (const poly of feat.geometry.coordinates) rings.push(poly[0]);
      }
      return rings;
    };

    // Phase 1: Process ADM2 districts
    for (const feat of adm2Geo.features) {
      const shapeName = feat.properties.shapeName || '';
      if (!shapeName) continue;

      let data: { value: number; nameEn: string; nameRu: string; color: string; height: number; unit: string } | null = null;

      if (isSewage) {
        const d = getSewageForDistrict(shapeName, year);
        if (d && d.value > 0) {
          data = { value: d.value, nameEn: d.entry.nameEn, nameRu: d.entry.nameRu, color: sewageColor(d.value), height: d.value / 100, unit: '%' };
        }
      } else if (csvData) {
        const d = lookupByShapeName(csvData, shapeName, year);
        if (d && d.value > 0) {
          data = {
            value: d.value, nameEn: d.nameEn, nameRu: d.nameRu,
            color: getIndicatorColor(indicator, d.value, globalMax),
            height: getIndicatorHeight(indicator, d.value, globalMax),
            unit: indicator.unit,
          };
        }
      }

      if (!data) continue;

      const rings = getRings(feat);
      if (rings.length === 0) continue;

      const mesh = buildRegionMesh(rings, converter, data, `adm2-${shapeName}`);
      if (mesh) {
        result.push(mesh);
        // Mark the parent region as having district coverage
        // We determine parent by checking centroid overlap with ADM1
        // For simplicity, mark all regions if ANY district matched
        regionsWithDistricts.add(shapeName);
      }
    }

    // Phase 2: Process ADM1 regions (only if no district data matched for that region)
    for (const feat of adm1Geo.features) {
      const shapeName = feat.properties.shapeName || '';
      if (!shapeName) continue;

      // Check if this region has district-level data in the CSV
      if (!isSewage && csvData && regionHasDistrictData(csvData, shapeName)) {
        continue; // Skip - districts rendered above
      }

      // For sewage, skip regions that are known to have district data (KK & Khorezm)
      if (isSewage && /karakalpakstan|khorezm/i.test(shapeName)) {
        continue;
      }

      let data: { value: number; nameEn: string; nameRu: string; color: string; height: number; unit: string } | null = null;

      if (isSewage) {
        const r = getSewageForRegion(shapeName, year);
        if (r && r.value > 0) {
          data = { value: r.value, nameEn: r.entry.nameEn, nameRu: r.entry.nameRu, color: sewageColor(r.value), height: r.value / 100, unit: '%' };
        }
      } else if (csvData) {
        const r = lookupByRegionName(csvData, shapeName, year);
        if (r && r.value > 0) {
          data = {
            value: r.value, nameEn: r.nameEn, nameRu: r.nameRu,
            color: getIndicatorColor(indicator, r.value, globalMax),
            height: getIndicatorHeight(indicator, r.value, globalMax),
            unit: indicator.unit,
          };
        }
      }

      if (!data) continue;

      const rings = getRings(feat);
      if (rings.length === 0) continue;

      const mesh = buildRegionMesh(rings, converter, data, `adm1-${shapeName}`);
      if (mesh) result.push(mesh);
    }

    return result;
  }, [adm2Geo, adm1Geo, converter, year, isSewage, csvData, indicator]);

  const handleClick = useCallback((key: string) => {
    setSelected(prev => prev === key ? null : key);
  }, []);

  return (
    <group>
      {regions.map(r => (
        <group key={r.key}>
          {/* Top face */}
          <mesh onClick={() => handleClick(r.key)}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[r.topVerts, 3]}
              />
            </bufferGeometry>
            <meshStandardMaterial
              color={r.color}
              transparent
              opacity={0.85}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Side walls */}
          {r.sideVerts && (
            <mesh>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[r.sideVerts, 3]}
                />
              </bufferGeometry>
              <meshStandardMaterial
                color={r.color}
                transparent
                opacity={0.6}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}

          {/* Border */}
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[r.borderVerts, 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#ffffff" transparent opacity={0.4} />
          </line>

          {/* Label */}
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
                  <div style={{ fontWeight: 600, color: r.color }}>{r.nameEn}</div>
                  <div style={{ opacity: 0.7 }}>{r.nameRu}</div>
                  <div style={{ marginTop: 2, fontWeight: 700 }}>
                    {r.value.toLocaleString()} {r.unit}
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

export default ChoroplethLayer;
