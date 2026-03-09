import { useMemo, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';
import { DISTRICT_MIGRATIONS, getMaxMigration } from '@/lib/migration-data';

interface MigrationLayerProps {
  terrain: TerrainData;
  exaggeration: number;
  year: number;
}

interface GeoJSONFeature {
  type: string;
  properties: Record<string, any>;
  geometry: { type: string; coordinates: any };
}

interface GeoJSONCollection {
  type: string;
  features: GeoJSONFeature[];
}

const DISTRICT_COLORS = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4',
  '#469990', '#dcbeff', '#9A6324', '#fffac8', '#800000',
  '#aaffc3', '#808000', '#ffd8b1', '#000075', '#a9a9a9',
];

const KK_BOUNDS = { minLon: 56, maxLon: 62, minLat: 41, maxLat: 46 };

function geoToMeshPos(
  lat: number, lon: number,
  bounds: GeoBounds, terrain: TerrainData, exaggeration: number,
  meshWidth: number, meshHeight: number,
): [number, number, number] | null {
  const nx = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
  const ny = (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
  if (nx < -0.5 || nx > 1.5 || ny < -0.5 || ny > 1.5) return null;
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

function isInKarakalpakstan(feature: GeoJSONFeature): boolean {
  const coords = feature.geometry.type === 'MultiPolygon'
    ? feature.geometry.coordinates[0][0]
    : feature.geometry.coordinates[0];
  if (!coords || coords.length < 3) return false;
  const [cLon, cLat] = centroid(coords);
  return cLon >= KK_BOUNDS.minLon && cLon <= KK_BOUNDS.maxLon &&
         cLat >= KK_BOUNDS.minLat && cLat <= KK_BOUNDS.maxLat;
}

/** Find migration data entry by matching district name */
function findMigrationData(name: string) {
  const normalized = name.toLowerCase().trim();
  return DISTRICT_MIGRATIONS.find(d => {
    const dn = d.name.toLowerCase();
    return normalized.includes(dn) || dn.includes(normalized) ||
      normalized.replace(/[^a-z]/g, '').includes(dn.replace(/[^a-z]/g, ''));
  });
}

/** Fan-triangulate with elevation offset applied */
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

/** Build side walls between base ring and elevated ring */
function buildSideWalls(
  basePoints: [number, number, number][],
  topPoints: [number, number, number][],
): number[] {
  const verts: number[] = [];
  for (let i = 0; i < basePoints.length; i++) {
    const ni = (i + 1) % basePoints.length;
    const b0 = basePoints[i], b1 = basePoints[ni];
    const t0 = topPoints[i], t1 = topPoints[ni];
    // Two triangles per quad
    verts.push(b0[0], b0[1], b0[2], b1[0], b1[1], b1[2], t0[0], t0[1], t0[2]);
    verts.push(t0[0], t0[1], t0[2], b1[0], b1[1], b1[2], t1[0], t1[1], t1[2]);
  }
  return verts;
}

interface DistrictData {
  name: string;
  color: string;
  migrationValue: number;
  topBorderPoints: THREE.Vector3[];
  topFillVertices: Float32Array;
  sideFillVertices: Float32Array;
  labelPos: [number, number, number];
}

const MigrationLayer = ({ terrain, exaggeration, year }: MigrationLayerProps) => {
  const [geojson, setGeojson] = useState<GeoJSONCollection | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

  useEffect(() => {
    fetch('/data/karakalpakstan_adm2.geojson')
      .then(r => r.json())
      .then(setGeojson)
      .catch(err => console.warn('Migration GeoJSON load failed:', err));
  }, []);

  const activeYear = useMemo(() => {
    if (year >= 2010 && year <= 2024) return year;
    if (year < 2010) return 2010;
    return 2024;
  }, [year]);

  const maxMig = useMemo(() => getMaxMigration(activeYear), [activeYear]);

  const districts = useMemo(() => {
    if (!geojson || !terrain.bounds) return [];

    const bounds = terrain.bounds;
    const tw = terrain.width;
    const th = terrain.height;
    const meshW = 10;
    const meshH = 10 * (th / tw);

    const kkFeatures = geojson.features.filter(f =>
      (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') && isInKarakalpakstan(f)
    );

    const result: DistrictData[] = [];

    kkFeatures.forEach((feature, fi) => {
      const name = feature.properties?.shapeName
        || feature.properties?.NAME_2
        || feature.properties?.name
        || feature.properties?.ADM2_EN
        || `District ${fi + 1}`;

      const outerRing = feature.geometry.type === 'MultiPolygon'
        ? feature.geometry.coordinates[0][0]
        : feature.geometry.coordinates[0];

      if (!outerRing || outerRing.length < 3) return;

      // Find migration data for this district
      const migData = findMigrationData(name);
      const migValue = migData?.values[activeYear] ?? 0;
      const t = maxMig > 0 ? Math.min(1, migValue / maxMig) : 0;
      const elevOffset = t * 0.8; // max 0.8 units height

      // Base points (on terrain surface)
      const basePoints: [number, number, number][] = [];
      // Top points (elevated by migration)
      const topPoints: [number, number, number][] = [];
      const topBorderPts: THREE.Vector3[] = [];

      for (const coord of outerRing) {
        const p = geoToMeshPos(coord[1], coord[0], bounds, terrain, exaggeration, meshW, meshH);
        if (p) {
          basePoints.push([p[0], p[1] + 0.05, p[2]]);
          topPoints.push([p[0], p[1] + 0.05 + elevOffset, p[2]]);
          topBorderPts.push(new THREE.Vector3(p[0], p[1] + 0.06 + elevOffset, p[2]));
        }
      }
      if (topPoints.length < 3) return;

      topBorderPts.push(topBorderPts[0].clone());

      // Top face
      const topVerts = fanTriangulate(topPoints);
      if (topVerts.length === 0) return;

      // Side walls
      const sideVerts = elevOffset > 0.01 ? buildSideWalls(basePoints, topPoints) : [];

      // Label centroid
      const [cLon, cLat] = centroid(outerRing);
      const labelP = geoToMeshPos(cLat, cLon, bounds, terrain, exaggeration, meshW, meshH);
      if (!labelP) return;

      result.push({
        name,
        color: DISTRICT_COLORS[fi % DISTRICT_COLORS.length],
        migrationValue: migValue,
        topBorderPoints: topBorderPts,
        topFillVertices: new Float32Array(topVerts),
        sideFillVertices: new Float32Array(sideVerts),
        labelPos: [labelP[0], labelP[1] + 0.3 + elevOffset, labelP[2]],
      });
    });

    return result;
  }, [geojson, terrain, exaggeration, activeYear, maxMig]);

  const handleClick = useCallback((name: string) => {
    setSelectedDistrict(prev => prev === name ? null : name);
  }, []);

  if (districts.length === 0) return null;

  return (
    <group>
      {districts.map((d, i) => {
        const topGeo = new THREE.BufferGeometry();
        topGeo.setAttribute('position', new THREE.Float32BufferAttribute(d.topFillVertices, 3));
        topGeo.computeVertexNormals();

        const borderGeo = new THREE.BufferGeometry().setFromPoints(d.topBorderPoints);

        let sideGeo: THREE.BufferGeometry | null = null;
        if (d.sideFillVertices.length > 0) {
          sideGeo = new THREE.BufferGeometry();
          sideGeo.setAttribute('position', new THREE.Float32BufferAttribute(d.sideFillVertices, 3));
          sideGeo.computeVertexNormals();
        }

        return (
          <group key={`district-${i}`}>
            {/* Top face */}
            <mesh
              geometry={topGeo}
              onClick={(e) => { e.stopPropagation(); handleClick(d.name); }}
              onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { document.body.style.cursor = 'auto'; }}
            >
              <meshStandardMaterial color={d.color} opacity={0.65} transparent side={THREE.DoubleSide} />
            </mesh>

            {/* Side walls */}
            {sideGeo && (
              <mesh geometry={sideGeo}>
                <meshStandardMaterial color={d.color} opacity={0.5} transparent side={THREE.DoubleSide} />
              </mesh>
            )}

            {/* Border outline */}
            <primitive object={new THREE.Line(borderGeo, new THREE.LineBasicMaterial({ color: '#ffffff', opacity: 0.8, transparent: true }))} />

            {/* Label on click */}
            {selectedDistrict === d.name && (
              <Html position={d.labelPos} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
                <div style={{
                  background: 'rgba(0,0,0,0.85)',
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  border: `2px solid ${d.color}`,
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                }}>
                  <div>{d.name}</div>
                  <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}>
                    Migration: {d.migrationValue.toLocaleString()} ({activeYear})
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

export default MigrationLayer;
