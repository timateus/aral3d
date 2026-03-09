import { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';
import { DISTRICT_MIGRATIONS, MIGRATION_YEARS, getMaxMigration } from '@/lib/migration-data';

interface MigrationLayerProps {
  terrain: TerrainData;
  exaggeration: number;
  year: number;
}

interface GeoJSONFeature {
  type: string;
  properties: Record<string, any>;
  geometry: {
    type: string;
    coordinates: any;
  };
}

interface GeoJSONCollection {
  type: string;
  features: GeoJSONFeature[];
}

/** Karakalpakstan approximate bounding box */
const KK_BOUNDS = { minLon: 56, maxLon: 62, minLat: 41, maxLat: 46 };

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

/** Centroid of a polygon ring */
function centroid(ring: number[][]): [number, number] {
  let sumLon = 0, sumLat = 0;
  for (const [lon, lat] of ring) { sumLon += lon; sumLat += lat; }
  return [sumLon / ring.length, sumLat / ring.length];
}

/** Check if a feature's centroid falls within Karakalpakstan bounds */
function isInKarakalpakstan(feature: GeoJSONFeature): boolean {
  const coords = feature.geometry.type === 'MultiPolygon'
    ? feature.geometry.coordinates[0][0]
    : feature.geometry.coordinates[0];
  if (!coords || coords.length < 3) return false;
  const [cLon, cLat] = centroid(coords);
  return cLon >= KK_BOUNDS.minLon && cLon <= KK_BOUNDS.maxLon &&
         cLat >= KK_BOUNDS.minLat && cLat <= KK_BOUNDS.maxLat;
}

/** Color from green (low migration) to red (high migration) */
function migrationColor(t: number): THREE.Color {
  // green -> yellow -> orange -> red
  const r = t < 0.5 ? t * 2 : 1;
  const g = t < 0.5 ? 1 : 1 - (t - 0.5) * 2;
  return new THREE.Color(r, g * 0.8, 0.05);
}

const MigrationLayer = ({ terrain, exaggeration, year }: MigrationLayerProps) => {
  const [geojson, setGeojson] = useState<GeoJSONCollection | null>(null);

  useEffect(() => {
    fetch('/data/karakalpakstan_adm2.geojson')
      .then(r => r.json())
      .then(setGeojson)
      .catch(err => console.warn('Migration GeoJSON load failed:', err));
  }, []);

  // Clamp year to available range
  const activeYear = useMemo(() => {
    if (year >= 2010 && year <= 2024) return year;
    if (year < 2010) return 2010;
    return 2024;
  }, [year]);

  const { polygons, labels } = useMemo(() => {
    if (!geojson || !terrain.bounds) return { polygons: [] as THREE.Mesh[], labels: [] as { pos: [number, number, number]; name: string; value: number }[] };

    const bounds = terrain.bounds;
    const tw = terrain.width;
    const th = terrain.height;
    const meshW = 10;
    const meshH = 10 * (th / tw);

    // Filter features in Karakalpakstan
    const kkFeatures = geojson.features.filter(f =>
      (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') && isInKarakalpakstan(f)
    );

    const maxMig = getMaxMigration(activeYear);
    const polys: THREE.Mesh[] = [];
    const lbls: { pos: [number, number, number]; name: string; value: number }[] = [];

    kkFeatures.forEach((feature, fi) => {
      // Match to district by index (sorted by centroid longitude for rough matching)
      // We'll assign districts by proximity
      const rings = feature.geometry.type === 'MultiPolygon'
        ? feature.geometry.coordinates.flatMap((p: number[][][][]) => p.map((r: number[][][]) => r[0]))
        : [feature.geometry.coordinates[0]];

      const outerRing = feature.geometry.type === 'MultiPolygon'
        ? feature.geometry.coordinates[0][0]
        : feature.geometry.coordinates[0];

      if (!outerRing || outerRing.length < 3) return;

      const [cLon, cLat] = centroid(outerRing);

      // Find closest district by name if properties have it, otherwise by index
      const district = fi < DISTRICT_MIGRATIONS.length ? DISTRICT_MIGRATIONS[fi] : null;
      const value = district?.values[activeYear] ?? 0;
      const t = maxMig > 0 ? Math.min(1, value / maxMig) : 0;

      // Build polygon fill using fan triangulation
      for (const ring of rings) {
        const points3d: [number, number, number][] = [];
        for (const coord of ring) {
          const p = geoToMeshPos(coord[1], coord[0], bounds, terrain, exaggeration, meshW, meshH);
          if (p) points3d.push(p);
        }
        if (points3d.length < 3) continue;

        let sumX = 0, sumY = 0, sumZ = 0;
        for (const p of points3d) { sumX += p[0]; sumY += p[1]; sumZ += p[2]; }
        const cx = sumX / points3d.length;
        const avgY = sumY / points3d.length + 0.06;
        const cz = sumZ / points3d.length;

        const vertices: number[] = [];
        for (let j = 0; j < points3d.length; j++) {
          const curr = points3d[j];
          const next = points3d[(j + 1) % points3d.length];
          vertices.push(cx, avgY, cz);
          vertices.push(curr[0], avgY, curr[2]);
          vertices.push(next[0], avgY, next[2]);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.computeVertexNormals();

        const color = migrationColor(t);
        const mat = new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        });

        polys.push(new THREE.Mesh(geo, mat));
      }

      // Label at centroid
      const labelPos = geoToMeshPos(cLat, cLon, bounds, terrain, exaggeration, meshW, meshH);
      if (labelPos && district) {
        lbls.push({ pos: [labelPos[0], labelPos[1] + 0.3, labelPos[2]], name: district.name, value });
      }
    });

    return { polygons: polys, labels: lbls };
  }, [geojson, terrain, exaggeration, activeYear]);

  if (polygons.length === 0) return null;

  return (
    <group>
      {polygons.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
      {labels.map((lbl, i) => (
        <Html key={`lbl-${i}`} position={lbl.pos} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
          <div style={{
            textAlign: 'center',
            whiteSpace: 'nowrap',
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
            fontFamily: "'Inter', system-ui, sans-serif",
          }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#fff' }}>{lbl.name}</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#ff6b6b' }}>
              {lbl.value.toLocaleString()}
            </div>
          </div>
        </Html>
      ))}
    </group>
  );
};

export default MigrationLayer;
