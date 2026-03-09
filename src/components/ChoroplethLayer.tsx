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
  choroplethExaggeration?: number;
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

const MAX_EXTRUDE = 2.0;

/**
 * Project lon/lat to the SAME coordinate system as the terrain mesh.
 * Terrain mesh center = origin, x spans [-meshWidth/2, meshWidth/2], z spans [-meshHeight/2, meshHeight/2].
 * Coordinates outside terrain bounds extrapolate naturally.
 */
function geoToMeshPos(
  lon: number, lat: number,
  terrainBounds: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  meshWidth: number, meshHeight: number,
): [number, number, number] {
  const nx = (lon - terrainBounds.minLon) / (terrainBounds.maxLon - terrainBounds.minLon);
  const ny = (lat - terrainBounds.minLat) / (terrainBounds.maxLat - terrainBounds.minLat);

  const x = (nx - 0.5) * meshWidth;
  const z = -(ny - 0.5) * meshHeight;

  return [x, 0.02, z];
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

function buildRegionMesh(
  rings: number[][][],
  converter: (lon: number, lat: number) => [number, number, number],
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
      return [p[0], p[1] + extrudeH, p[2]] as [number, number, number];
    };
    allTopVerts.push(...fanTriangulate(ring, topConverter));

    if (extrudeH > 0.01) {
      allSideVerts.push(...buildSideWalls(ring, converter, extrudeH));
    }

    const borderPts = ring.map(([lon, lat]) => {
      const p = converter(lon, lat);
      return [p[0], p[1] + extrudeH + 0.01, p[2]] as [number, number, number];
    });
    for (const pt of borderPts) allBorderVerts.push(...pt);
  }

  if (allTopVerts.length === 0) return null;

  const mainRing = rings[0];
  const [clon, clat] = centroid(mainRing);
  const labelP = converter(clon, clat);
  const labelPos: [number, number, number] = [labelP[0], labelP[1] + extrudeH + 0.15, labelP[2]];

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

const ChoroplethLayer = ({ terrain, exaggeration, year, indicatorId = 'sewage', choroplethExaggeration = 1.0 }: ChoroplethLayerProps) => {
  const [adm2Geo, setAdm2Geo] = useState<GeoJSONCollection | null>(null);
  const [adm1Geo, setAdm1Geo] = useState<GeoJSONCollection | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<CsvData | null>(null);

  const indicator = useMemo(() => INDICATORS.find(i => i.id === indicatorId) || INDICATORS[0], [indicatorId]);
  const isSewage = indicator.id === 'sewage';

  useEffect(() => {
    Promise.all([
      fetch('/data/geoBoundaries-UZB-ADM2.geojson').then(r => r.json()),
      fetch('/data/geoBoundaries-UZB-ADM1.geojson').then(r => r.json()),
    ]).then(([a2, a1]) => {
      console.log('[Choropleth] Loaded ADM2 features:', a2.features.length, 'ADM1 features:', a1.features.length);
      setAdm2Geo(a2);
      setAdm1Geo(a1);
    });
  }, []);

  useEffect(() => {
    if (isSewage) { setCsvData(null); return; }
    loadIndicatorData(indicator).then(d => setCsvData(d));
  }, [indicator, isSewage]);

  const meshWidth = (terrain.width / Math.max(terrain.width, terrain.height)) * 10;
  const meshHeight = (terrain.height / Math.max(terrain.width, terrain.height)) * 10;
  const safeBounds = terrain.bounds || { minLon: 56, maxLon: 62, minLat: 42, maxLat: 47 };

  const converter = useCallback((lon: number, lat: number) =>
    geoToMeshPos(lon, lat, safeBounds, meshWidth, meshHeight),
    [safeBounds, meshWidth, meshHeight]
  );

  const regions = useMemo(() => {
    if (!adm2Geo || !adm1Geo) return [];
    if (!isSewage && !csvData) return [];

    const result: RegionMesh[] = [];
    const globalMax = csvData ? getGlobalMax(csvData) : 100;

    // First pass: collect all non-zero values to find the minimum
    const allValues: number[] = [];
    const collectValue = (shapeName: string, isAdm2: boolean) => {
      if (isSewage) {
        const d = isAdm2 ? getSewageForDistrict(shapeName, year) : getSewageForRegion(shapeName, year);
        if (d && d.value > 0) allValues.push(d.value);
      } else if (csvData) {
        const d = isAdm2 ? lookupByShapeName(csvData, shapeName, year) : lookupByRegionName(csvData, shapeName, year);
        if (d && d.value > 0) allValues.push(d.value);
      }
    };
    for (const feat of adm2Geo.features) {
      const sn = feat.properties.shapeName || '';
      if (sn) collectValue(sn, true);
    }
    for (const feat of adm1Geo.features) {
      const sn = feat.properties.shapeName || '';
      if (sn) collectValue(sn, false);
    }
    const globalMin = allValues.length > 0 ? Math.min(...allValues) : 0;
    const range = isSewage ? (100 - globalMin) : (globalMax - globalMin);

    const getNormalizedHeight = (value: number): number => {
      if (range <= 0 || value <= 0) return 0;
      const normalized = (value - globalMin) / range;
      return Math.sqrt(Math.max(0, normalized)) * choroplethExaggeration;
    };

    const getRings = (feat: GeoJSONFeature): number[][][] => {
      const rings: number[][][] = [];
      if (feat.geometry.type === 'Polygon') {
        rings.push(feat.geometry.coordinates[0]);
      } else if (feat.geometry.type === 'MultiPolygon') {
        for (const poly of feat.geometry.coordinates) rings.push(poly[0]);
      }
      return rings;
    };

    // Phase 1: ADM2 districts
    const matchedAdm1Regions = new Set<string>();
    for (const feat of adm2Geo.features) {
      const shapeName = feat.properties.shapeName || '';
      if (!shapeName) continue;

      let data: { value: number; nameEn: string; nameRu: string; color: string; height: number; unit: string } | null = null;

      if (isSewage) {
        const d = getSewageForDistrict(shapeName, year);
        if (d && d.value > 0) {
          data = { value: d.value, nameEn: d.entry.nameEn, nameRu: d.entry.nameRu, color: sewageColor(d.value), height: getNormalizedHeight(d.value), unit: '%' };
        }
      } else if (csvData) {
        const d = lookupByShapeName(csvData, shapeName, year);
        if (d && d.value > 0) {
          data = {
            value: d.value, nameEn: d.nameEn, nameRu: d.nameRu,
            color: getIndicatorColor(indicator, d.value, globalMax),
            height: getNormalizedHeight(d.value),
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
        const parent = feat.properties.shapeGroup || feat.properties.ADM1 || '';
        if (parent) matchedAdm1Regions.add(parent);
      }
    }

    // Phase 2: ADM1 regions (fallback)
    for (const feat of adm1Geo.features) {
      const shapeName = feat.properties.shapeName || '';
      if (!shapeName) continue;

      if (!isSewage && csvData && regionHasDistrictData(csvData, shapeName)) continue;
      if (isSewage && /karakalpakstan|khorezm/i.test(shapeName)) continue;

      let data: { value: number; nameEn: string; nameRu: string; color: string; height: number; unit: string } | null = null;

      if (isSewage) {
        const r = getSewageForRegion(shapeName, year);
        if (r && r.value > 0) {
          data = { value: r.value, nameEn: r.entry.nameEn, nameRu: r.entry.nameRu, color: sewageColor(r.value), height: getNormalizedHeight(r.value), unit: '%' };
        }
      } else if (csvData) {
        const r = lookupByRegionName(csvData, shapeName, year);
        if (r && r.value > 0) {
          data = {
            value: r.value, nameEn: r.nameEn, nameRu: r.nameRu,
            color: getIndicatorColor(indicator, r.value, globalMax),
            height: getNormalizedHeight(r.value),
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

    console.log('[Choropleth] Built regions:', result.length, 'indicator:', indicatorId, 'globalMax:', globalMax);
    return result;
  }, [adm2Geo, adm1Geo, converter, year, isSewage, csvData, indicator]);

  const handleClick = useCallback((key: string) => {
    setSelected(prev => prev === key ? null : key);
  }, []);

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
