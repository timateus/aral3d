import { useMemo, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { TerrainData } from '@/lib/geotiff-loader';
import { getSewageForDistrict, getSewageForRegion, sewageColor } from '@/lib/sewage-data';
import {
  INDICATORS,
  DemographicIndicator,
  loadIndicatorData,
  lookupByShapeName,
  lookupByRegionName,
  getMaxForYear,
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

const ChoroplethLayer = ({ terrain, exaggeration, year, indicatorId = 'sewage' }: ChoroplethLayerProps) => {
  const [kkGeo, setKkGeo] = useState<GeoJSONCollection | null>(null);
  const [regionGeo, setRegionGeo] = useState<GeoJSONCollection | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<any>(null);

  const indicator = useMemo(() => INDICATORS.find(i => i.id === indicatorId) || INDICATORS[0], [indicatorId]);
  const isSewage = indicator.id === 'sewage';

  // Load GeoJSON
  useEffect(() => {
    Promise.all([
      fetch('/data/karakalpakstan_adm2.geojson').then(r => r.json()),
      fetch('/data/uzbekistan_regions.geojson').then(r => r.json()),
    ]).then(([kk, reg]) => {
      setKkGeo(kk);
      setRegionGeo(reg);
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

  // Determine value/color for a feature
  const getFeatureData = useCallback((shapeName: string, regionName: string | null, isDistrict: boolean) => {
    if (isSewage) {
      if (isDistrict) {
        const d = getSewageForDistrict(shapeName, year);
        if (d) return { value: d.value, nameEn: d.entry.nameEn, nameRu: d.entry.nameRu, color: sewageColor(d.value), height: d.value / 100, unit: '%' };
      }
      if (regionName) {
        const r = getSewageForRegion(regionName, year);
        if (r) return { value: r.value, nameEn: r.entry.nameEn, nameRu: r.entry.nameRu, color: sewageColor(r.value), height: r.value / 100, unit: '%' };
      }
      return null;
    }

    if (!csvData) return null;
    const maxVal = getMaxForYear(csvData, year);

    if (isDistrict) {
      const d = lookupByShapeName(csvData, shapeName, year);
      if (d) return {
        value: d.value, nameEn: d.nameEn, nameRu: d.nameRu,
        color: getIndicatorColor(indicator, d.value, maxVal),
        height: getIndicatorHeight(indicator, d.value, maxVal),
        unit: indicator.unit,
      };
    }
    if (regionName) {
      const r = lookupByRegionName(csvData, regionName, year);
      if (r) return {
        value: r.value, nameEn: r.nameEn, nameRu: r.nameRu,
        color: getIndicatorColor(indicator, r.value, maxVal),
        height: getIndicatorHeight(indicator, r.value, maxVal),
        unit: indicator.unit,
      };
    }
    return null;
  }, [isSewage, csvData, indicator, year]);

  const regions = useMemo(() => {
    if (!kkGeo || !regionGeo) return [];
    if (!isSewage && !csvData) return [];

    const result: RegionMesh[] = [];

    const processFeature = (feat: GeoJSONFeature, isDistrict: boolean) => {
      const shapeName = feat.properties.shapeName || feat.properties.ADM2_EN || feat.properties.ADM1_EN || '';
      const regionName = feat.properties.ADM1_EN || '';
      const data = getFeatureData(shapeName, regionName, isDistrict);
      if (!data) return;

      const rings: number[][][] = [];
      if (feat.geometry.type === 'Polygon') {
        rings.push(feat.geometry.coordinates[0]);
      } else if (feat.geometry.type === 'MultiPolygon') {
        for (const poly of feat.geometry.coordinates) rings.push(poly[0]);
      }

      const allTopVerts: number[] = [];
      const allSideVerts: number[] = [];
      const allBorderVerts: number[] = [];
      const extrudeH = data.height * MAX_EXTRUDE;

      for (const ring of rings) {
        // Top face at extruded height
        const topConverter = (lon: number, lat: number) => {
          const p = converter(lon, lat);
          if (!p) return null;
          return [p[0], p[1] + extrudeH, p[2]] as [number, number, number];
        };
        allTopVerts.push(...fanTriangulate(ring, topConverter));

        // Side walls
        if (extrudeH > 0.01) {
          const sideConverter = (lon: number, lat: number) => converter(lon, lat);
          allSideVerts.push(...buildSideWalls(ring, sideConverter, extrudeH));
        }

        // Border
        const borderPts = ring.map(([lon, lat]) => {
          const p = converter(lon, lat);
          return p ? [p[0], p[1] + extrudeH + 0.01, p[2]] : null;
        }).filter(Boolean) as [number, number, number][];
        for (const pt of borderPts) allBorderVerts.push(...pt);
      }

      if (allTopVerts.length === 0) return;

      // Label position
      const mainRing = rings[0];
      const [clon, clat] = centroid(mainRing);
      const labelP = converter(clon, clat);
      const labelPos: [number, number, number] = labelP
        ? [labelP[0], labelP[1] + extrudeH + 0.15, labelP[2]]
        : [0, 0, 0];

      result.push({
        key: shapeName || regionName,
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
      });
    };

    // KK districts
    for (const feat of kkGeo.features) {
      processFeature(feat, true);
    }

    // Regions (skip KK and Khorezm since they have district data)
    for (const feat of regionGeo.features) {
      const name = feat.properties.ADM1_EN || '';
      if (/karakalpakstan/i.test(name)) continue;
      if (/khorezm/i.test(name)) {
        // For Khorezm, if we had district geojson we'd use it. For now render region-level.
        // Actually we skip and handle separately if district data exists.
      }
      processFeature(feat, false);
    }

    return result;
  }, [kkGeo, regionGeo, converter, year, getFeatureData, isSewage, csvData]);

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
