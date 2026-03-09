import { useMemo, useState, useEffect } from 'react';
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

/** Map from GeoJSON shapeName → migration data district name */
const SHAPE_TO_DISTRICT: Record<string, string> = {
  // These will be matched by checking centroid proximity since shapeNames
  // in the GeoJSON may differ from our district names.
  // We'll use centroid-based matching instead.
};

/** Known district centroids (approximate lon, lat) for matching */
const DISTRICT_CENTROIDS: Record<string, [number, number]> = {
  'Nukus city':      [59.60, 42.46],
  'Amudarya':        [61.00, 41.60],
  'Beruniy':         [60.75, 41.70],
  'Bozatau':         [57.80, 42.80],
  'Karauzak':        [60.00, 42.10],
  'Kegeyli':         [59.60, 42.08],
  'Kungrad':         [58.70, 43.00],
  'Kanlykul':        [60.35, 41.85],
  'Muynak':          [58.70, 43.80],
  'Nukus district':  [59.30, 42.50],
  'Takhiatash':      [59.70, 42.35],
  'Takhtakupyr':     [58.50, 42.50],
  'Turtkul':         [60.95, 41.55],
  'Khojeyli':        [59.45, 42.30],
  'Chimbay':         [59.80, 42.95],
  'Shumanai':        [59.90, 41.90],
  'Ellikkala':       [60.70, 41.40],
};

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

/** Find closest district by centroid distance */
function matchDistrict(featureCentroid: [number, number]): string | null {
  const [fLon, fLat] = featureCentroid;
  let bestDist = Infinity;
  let bestName: string | null = null;
  for (const [name, [dLon, dLat]] of Object.entries(DISTRICT_CENTROIDS)) {
    const dist = Math.sqrt((fLon - dLon) ** 2 + (fLat - dLat) ** 2);
    if (dist < bestDist) {
      bestDist = dist;
      bestName = name;
    }
  }
  // Only match if reasonably close (< 1.5 degrees)
  return bestDist < 1.5 ? bestName : null;
}

function migrationColor(t: number): THREE.Color {
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

  const { borders, labels } = useMemo(() => {
    if (!geojson || !terrain.bounds) return { borders: [] as JSX.Element[], labels: [] as { pos: [number, number, number]; name: string }[] };

    const bounds = terrain.bounds;
    const tw = terrain.width;
    const th = terrain.height;
    const meshW = 10;
    const meshH = 10 * (th / tw);

    const kkFeatures = geojson.features.filter(f =>
      (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') && isInKarakalpakstan(f)
    );

    const lines: JSX.Element[] = [];
    const lbls: { pos: [number, number, number]; name: string }[] = [];
    const usedDistricts = new Set<string>();

    kkFeatures.forEach((feature, fi) => {
      const outerRing = feature.geometry.type === 'MultiPolygon'
        ? feature.geometry.coordinates[0][0]
        : feature.geometry.coordinates[0];

      if (!outerRing || outerRing.length < 3) return;

      const [cLon, cLat] = centroid(outerRing);
      const districtName = matchDistrict([cLon, cLat]);
      if (!districtName || usedDistricts.has(districtName)) return;
      usedDistricts.add(districtName);

      // Get all rings for border rendering
      const rings = feature.geometry.type === 'MultiPolygon'
        ? feature.geometry.coordinates.flatMap((p: number[][][][]) => p.map((r: number[][][]) => r[0]))
        : [feature.geometry.coordinates[0]];

      for (const ring of rings) {
        const points3d: THREE.Vector3[] = [];
        for (const coord of ring) {
          const p = geoToMeshPos(coord[1], coord[0], bounds, terrain, exaggeration, meshW, meshH);
          if (p) points3d.push(new THREE.Vector3(p[0], p[1] + 0.05, p[2]));
        }
        if (points3d.length < 3) continue;

        // Close the loop
        points3d.push(points3d[0].clone());

        const lineGeo = new THREE.BufferGeometry().setFromPoints(points3d);
        lines.push(
          <line key={`border-${fi}-${ring === rings[0] ? 0 : 1}`} geometry={lineGeo}>
            <lineBasicMaterial color="#ffffff" opacity={0.6} transparent linewidth={1} />
          </line>
        );
      }

      // Label at centroid
      const labelPos = geoToMeshPos(cLat, cLon, bounds, terrain, exaggeration, meshW, meshH);
      if (labelPos) {
        lbls.push({
          pos: [labelPos[0], labelPos[1] + 0.15, labelPos[2]],
          name: districtName,
        });
      }
    });

    return { borders: lines, labels: lbls };
  }, [geojson, terrain, exaggeration]);

  if (borders.length === 0) return null;

  return (
    <group>
      {borders}
      {labels.map((lbl, i) => (
        <Html key={`lbl-${i}`} position={lbl.pos} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
          <div style={{
            textAlign: 'center',
            whiteSpace: 'nowrap',
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
            fontFamily: "'Inter', system-ui, sans-serif",
          }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#fff' }}>{lbl.name}</div>
          </div>
        </Html>
      ))}
    </group>
  );
};

export default MigrationLayer;
