import { useMemo, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';
import { getSewageForDistrict, getSewageForRegion, sewageColor, SewageEntry } from '@/lib/sewage-data';

interface ChoroplethLayerProps {
  terrain: TerrainData;
  exaggeration: number;
  year: number;
}

// Bounds for filtering KK & Khorezm districts from the ADM2 file
const KK_KHOREZM_BOUNDS = { minLon: 56, maxLon: 62, minLat: 40, maxLat: 46 };

function geoToMeshPos(
  lat: number, lon: number,
  bounds: GeoBounds, terrain: TerrainData, exaggeration: number,
  meshWidth: number, meshHeight: number,
): [number, number, number] | null {
  const nx = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
  const ny = (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
  const x = (nx - 0.5) * meshWidth;
  const planeY = (ny - 0.5) * meshHeight;
  const inBounds = nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1;
  let zHeight = 0;
  if (inBounds) {
    const pixelX = Math.floor(nx * (terrain.width - 1));
    const pixelY = Math.floor((1 - ny) * (terrain.height - 1));
    const idx = pixelY * terrain.width + pixelX;
    let elev = terrain.elevations[idx] || terrain.minElevation;
    if (terrain.noDataValue !== null && elev === terrain.noDataValue) elev = terrain.minElevation;
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    zHeight = ((elev - terrain.minElevation) / elevRange) * 10 * (exaggeration / 100);
  }
  return [x, zHeight, -planeY];
}

function centroid(ring: number[][]): [number, number] {
  let sumLon = 0, sumLat = 0;
  for (const [lon, lat] of ring) { sumLon += lon; sumLat += lat; }
  return [sumLon / ring.length, sumLat / ring.length];
}

function fanTriangulate(points: [number, number, number][]): number[] {
  if (points.length < 3) return [];
  const vertices: number[] = [];
  let cx = 0, cy = 0, cz = 0;
  for (const p of points) { cx += p[0]; cy += p[1]; cz += p[2]; }
  cx /= points.length; cy /= points.length; cz /= points.length;
  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    vertices.push(cx, cy, cz, curr[0], curr[1], curr[2], next[0], next[1], next[2]);
  }
  return vertices;
}

function buildSideWalls(
  basePoints: [number, number, number][],
  topPoints: [number, number, number][],
): number[] {
  const verts: number[] = [];
  for (let i = 0; i < basePoints.length; i++) {
    const ni = (i + 1) % basePoints.length;
    const b0 = basePoints[i], b1 = basePoints[ni];
    const t0 = topPoints[i], t1 = topPoints[ni];
    verts.push(b0[0], b0[1], b0[2], b1[0], b1[1], b1[2], t0[0], t0[1], t0[2]);
    verts.push(t0[0], t0[1], t0[2], b1[0], b1[1], b1[2], t1[0], t1[1], t1[2]);
  }
  return verts;
}

function extractPolygonRings(geometry: any): number[][][][] {
  const rings: number[][][][] = [];
  const processMP = (coords: number[][][][]) => { for (const p of coords) rings.push(p); };
  if (geometry.geometries) {
    for (const geom of geometry.geometries) {
      if (geom.type === 'MultiPolygon') processMP(geom.coordinates);
      else if (geom.type === 'Polygon') rings.push(geom.coordinates);
    }
  } else if (geometry.type === 'MultiPolygon') processMP(geometry.coordinates);
  else if (geometry.type === 'Polygon') rings.push(geometry.coordinates);
  return rings;
}

function isInKKKhorezm(ring: number[][]): boolean {
  const [cLon, cLat] = centroid(ring);
  return cLon >= KK_KHOREZM_BOUNDS.minLon && cLon <= KK_KHOREZM_BOUNDS.maxLon &&
         cLat >= KK_KHOREZM_BOUNDS.minLat && cLat <= KK_KHOREZM_BOUNDS.maxLat;
}

interface ZoneData {
  name: string;
  nameRu: string;
  color: string;
  value: number;
  topFillVertices: Float32Array;
  sideFillVertices: Float32Array;
  topBorderPoints: THREE.Vector3[];
  labelPos: [number, number, number];
}

const ChoroplethLayer = ({ terrain, exaggeration, year }: ChoroplethLayerProps) => {
  const [regionGeo, setRegionGeo] = useState<any>(null);
  const [districtGeo, setDistrictGeo] = useState<any>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  useEffect(() => {
    fetch('/data/uzbekistan_regions.geojson').then(r => r.json()).then(setRegionGeo).catch(() => {});
    fetch('/data/karakalpakstan_adm2.geojson').then(r => r.json()).then(setDistrictGeo).catch(() => {});
  }, []);

  const activeYear = useMemo(() => {
    if (year >= 2010 && year <= 2024) return year;
    return year < 2010 ? 2010 : 2024;
  }, [year]);

  const zones = useMemo(() => {
    if (!terrain.bounds) return [];
    const bounds = terrain.bounds;
    const meshW = 10;
    const meshH = 10 * (terrain.height / terrain.width);
    const result: ZoneData[] = [];

    const processFeature = (
      outerRing: number[][],
      name: string, nameRu: string, value: number, step: number
    ) => {
      const color = sewageColor(value);
      const t = Math.min(1, value / 100);
      const elevOffset = t * 0.8;

      const sampledRing = outerRing.filter((_, i) => i % step === 0);
      const basePoints: [number, number, number][] = [];
      const topPoints: [number, number, number][] = [];
      const topBorderPts: THREE.Vector3[] = [];

      for (const coord of sampledRing) {
        const p = geoToMeshPos(coord[1], coord[0], bounds, terrain, exaggeration, meshW, meshH);
        if (p) {
          basePoints.push([p[0], p[1] + 0.05, p[2]]);
          topPoints.push([p[0], p[1] + 0.05 + elevOffset, p[2]]);
          topBorderPts.push(new THREE.Vector3(p[0], p[1] + 0.06 + elevOffset, p[2]));
        }
      }
      if (topPoints.length < 3) return;
      topBorderPts.push(topBorderPts[0].clone());

      const topVerts = fanTriangulate(topPoints);
      if (topVerts.length === 0) return;
      const sideVerts = elevOffset > 0.01 ? buildSideWalls(basePoints, topPoints) : [];

      const [cLon, cLat] = centroid(outerRing);
      const labelP = geoToMeshPos(cLat, cLon, bounds, terrain, exaggeration, meshW, meshH);
      if (!labelP) return;

      result.push({
        name, nameRu, color, value,
        topFillVertices: new Float32Array(topVerts),
        sideFillVertices: new Float32Array(sideVerts),
        topBorderPoints: topBorderPts,
        labelPos: [labelP[0], labelP[1] + 0.3 + elevOffset, labelP[2]],
      });
    };

    // 1) District-level: KK & Khorezm from ADM2 GeoJSON
    if (districtGeo) {
      for (const feature of districtGeo.features) {
        const shapeName = feature.properties?.shapeName;
        if (!shapeName) continue;
        const outerRing = feature.geometry.type === 'MultiPolygon'
          ? feature.geometry.coordinates[0][0]
          : feature.geometry.coordinates[0];
        if (!outerRing || outerRing.length < 3) continue;
        if (!isInKKKhorezm(outerRing)) continue;

        const data = getSewageForDistrict(shapeName, activeYear);
        if (!data) continue;

        const step = Math.max(1, Math.floor(outerRing.length / 300));
        processFeature(outerRing, data.entry.nameEn, data.entry.nameRu, data.value, step);
      }
    }

    // 2) Regional-level: everything except KK and Khorezm
    if (regionGeo) {
      for (const feature of regionGeo.features) {
        const adm1 = feature.properties?.ADM1_EN;
        if (!adm1) continue;
        // Skip KK and Khorezm (handled at district level)
        if (adm1 === 'Republic of Karakalpakstan' || adm1 === 'Khorezm region') continue;

        const data = getSewageForRegion(adm1, activeYear);
        if (!data) continue;

        const polygonRings = extractPolygonRings(feature.geometry);
        for (const polygon of polygonRings) {
          const outerRing = polygon[0];
          if (!outerRing || outerRing.length < 3) continue;
          const step = Math.max(1, Math.floor(outerRing.length / 200));
          processFeature(outerRing, data.entry.nameEn, data.entry.nameRu, data.value, step);
        }
      }
    }

    return result;
  }, [regionGeo, districtGeo, terrain, exaggeration, activeYear]);

  const handleClick = useCallback((name: string) => {
    setSelectedZone(prev => prev === name ? null : name);
  }, []);

  if (zones.length === 0) return null;

  return (
    <group>
      {zones.map((z, i) => {
        const topGeo = new THREE.BufferGeometry();
        topGeo.setAttribute('position', new THREE.Float32BufferAttribute(z.topFillVertices, 3));
        topGeo.computeVertexNormals();

        const borderGeo = new THREE.BufferGeometry().setFromPoints(z.topBorderPoints);

        let sideGeo: THREE.BufferGeometry | null = null;
        if (z.sideFillVertices.length > 0) {
          sideGeo = new THREE.BufferGeometry();
          sideGeo.setAttribute('position', new THREE.Float32BufferAttribute(z.sideFillVertices, 3));
          sideGeo.computeVertexNormals();
        }

        return (
          <group key={`zone-${i}`}>
            <mesh
              geometry={topGeo}
              onClick={(e) => { e.stopPropagation(); handleClick(z.name); }}
              onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { document.body.style.cursor = 'auto'; }}
            >
              <meshStandardMaterial color={z.color} opacity={0.65} transparent side={THREE.DoubleSide} />
            </mesh>

            {sideGeo && (
              <mesh geometry={sideGeo}>
                <meshStandardMaterial color={z.color} opacity={0.5} transparent side={THREE.DoubleSide} />
              </mesh>
            )}

            <primitive object={new THREE.Line(borderGeo, new THREE.LineBasicMaterial({ color: '#ffffff', opacity: 0.7, transparent: true }))} />

            {selectedZone === z.name && (
              <Html position={z.labelPos} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
                <div style={{
                  background: 'rgba(0,0,0,0.9)',
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  border: `2px solid ${z.color}`,
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                }}>
                  <div>{z.name}</div>
                  <div style={{ fontSize: '10px', opacity: 0.7 }}>{z.nameRu}</div>
                  <div style={{ fontSize: '11px', marginTop: '2px', color: z.color }}>
                    Sewage: {z.value.toFixed(1)}% ({activeYear})
                  </div>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
};

export default ChoroplethLayer;
