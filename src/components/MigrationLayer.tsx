import { useMemo, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';

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

/** Distinct colors for districts */
const DISTRICT_COLORS = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4',
  '#469990', '#dcbeff', '#9A6324', '#fffac8', '#800000',
  '#aaffc3', '#808000', '#ffd8b1', '#000075', '#a9a9a9',
];

/** Karakalpakstan approximate bounding box */
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

/** Fan-triangulate a ring of 3D points into triangles */
function fanTriangulate(points: [number, number, number][]): number[] {
  if (points.length < 3) return [];
  const vertices: number[] = [];
  // Use centroid as fan center
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

interface DistrictData {
  name: string;
  color: string;
  borderPoints: THREE.Vector3[];
  fillVertices: Float32Array;
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
      // Get name from properties
      const name = feature.properties?.shapeName 
        || feature.properties?.NAME_2 
        || feature.properties?.name 
        || feature.properties?.ADM2_EN
        || `District ${fi + 1}`;

      // Get outer ring
      const outerRing = feature.geometry.type === 'MultiPolygon'
        ? feature.geometry.coordinates[0][0]
        : feature.geometry.coordinates[0];

      if (!outerRing || outerRing.length < 3) return;

      // Convert to 3D positions
      const points3d: [number, number, number][] = [];
      const borderPts: THREE.Vector3[] = [];
      
      for (const coord of outerRing) {
        const p = geoToMeshPos(coord[1], coord[0], bounds, terrain, exaggeration, meshW, meshH);
        if (p) {
          points3d.push([p[0], p[1] + 0.06, p[2]]);
          borderPts.push(new THREE.Vector3(p[0], p[1] + 0.07, p[2]));
        }
      }
      if (points3d.length < 3) return;

      // Close border loop
      borderPts.push(borderPts[0].clone());

      // Triangulate fill
      const verts = fanTriangulate(points3d);
      if (verts.length === 0) return;

      // Centroid for label
      const [cLon, cLat] = centroid(outerRing);
      const labelP = geoToMeshPos(cLat, cLon, bounds, terrain, exaggeration, meshW, meshH);
      if (!labelP) return;

      result.push({
        name,
        color: DISTRICT_COLORS[fi % DISTRICT_COLORS.length],
        borderPoints: borderPts,
        fillVertices: new Float32Array(verts),
        labelPos: [labelP[0], labelP[1] + 0.2, labelP[2]],
      });
    });

    return result;
  }, [geojson, terrain, exaggeration]);

  const handleClick = useCallback((name: string) => {
    setSelectedDistrict(prev => prev === name ? null : name);
  }, []);

  if (districts.length === 0) return null;

  return (
    <group>
      {districts.map((d, i) => {
        const fillGeo = new THREE.BufferGeometry();
        fillGeo.setAttribute('position', new THREE.Float32BufferAttribute(d.fillVertices, 3));
        fillGeo.computeVertexNormals();

        const borderGeo = new THREE.BufferGeometry().setFromPoints(d.borderPoints);

        return (
          <group key={`district-${i}`}>
            {/* Filled polygon */}
            <mesh
              geometry={fillGeo}
              onClick={(e) => { e.stopPropagation(); handleClick(d.name); }}
              onPointerOver={(e) => { (e.object as THREE.Mesh).material = new THREE.MeshBasicMaterial({ color: d.color, opacity: 0.7, transparent: true, side: THREE.DoubleSide }); document.body.style.cursor = 'pointer'; }}
              onPointerOut={(e) => { (e.object as THREE.Mesh).material = new THREE.MeshBasicMaterial({ color: d.color, opacity: 0.45, transparent: true, side: THREE.DoubleSide }); document.body.style.cursor = 'auto'; }}
            >
              <meshBasicMaterial color={d.color} opacity={0.45} transparent side={THREE.DoubleSide} />
            </mesh>

            {/* Border outline */}
            <line geometry={borderGeo}>
              <lineBasicMaterial color="#ffffff" opacity={0.8} transparent linewidth={1} />
            </line>

            {/* Label on click */}
            {selectedDistrict === d.name && (
              <Html position={d.labelPos} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
                <div style={{
                  background: 'rgba(0,0,0,0.85)',
                  color: '#fff',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  border: `2px solid ${d.color}`,
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                }}>
                  {d.name}
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
