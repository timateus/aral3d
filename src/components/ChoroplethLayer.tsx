import { useMemo, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';
import { SEWAGE_YEARS, REGION_SEWAGE, getSewageValue, sewageColor } from '@/lib/sewage-data';

interface ChoroplethLayerProps {
  terrain: TerrainData;
  exaggeration: number;
  year: number;
}

interface GeoFeature {
  type: string;
  properties: { ADM1_EN: string; ADM1_RU: string; ADM1_UZ: string; id: number };
  geometry: any;
}

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

function extractPolygonRings(geometry: any): number[][][][] {
  const rings: number[][][][] = [];
  const processMultiPolygon = (coords: number[][][][]) => {
    for (const polygon of coords) rings.push(polygon);
  };
  if (geometry.geometries) {
    for (const geom of geometry.geometries) {
      if (geom.type === 'MultiPolygon') processMultiPolygon(geom.coordinates);
      else if (geom.type === 'Polygon') rings.push(geom.coordinates);
    }
  } else if (geometry.type === 'MultiPolygon') {
    processMultiPolygon(geometry.coordinates);
  } else if (geometry.type === 'Polygon') {
    rings.push(geometry.coordinates);
  }
  return rings;
}

interface RegionData {
  name: string;
  nameRu: string;
  color: string;
  value: number | null;
  fillVertices: Float32Array;
  borderPoints: THREE.Vector3[];
  labelPos: [number, number, number];
}

const ChoroplethLayer = ({ terrain, exaggeration, year }: ChoroplethLayerProps) => {
  const [geojson, setGeojson] = useState<{ features: GeoFeature[] } | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  useEffect(() => {
    fetch('/data/uzbekistan_regions.geojson')
      .then(r => r.json())
      .then(setGeojson)
      .catch(err => console.warn('Uzbekistan GeoJSON load failed:', err));
  }, []);

  const activeYear = useMemo(() => {
    if (year >= 2010 && year <= 2024) return year;
    return year < 2010 ? 2010 : 2024;
  }, [year]);

  const regions = useMemo(() => {
    if (!geojson || !terrain.bounds) return [];

    const bounds = terrain.bounds;
    const tw = terrain.width;
    const th = terrain.height;
    const meshW = 10;
    const meshH = 10 * (th / tw);

    const result: RegionData[] = [];

    for (const feature of geojson.features) {
      const name = feature.properties.ADM1_EN;
      const nameRu = feature.properties.ADM1_RU;
      const value = getSewageValue(name, activeYear);
      const color = value !== null ? sewageColor(value) : '#555555';

      const polygonRings = extractPolygonRings(feature.geometry);
      
      const allFillVerts: number[] = [];
      const allBorderPts: THREE.Vector3[] = [];
      let bestCentroid: [number, number] | null = null;
      let bestRingLen = 0;

      for (const polygon of polygonRings) {
        const outerRing = polygon[0];
        if (!outerRing || outerRing.length < 3) continue;

        // Sample every Nth point for performance (these polygons are very detailed)
        const step = Math.max(1, Math.floor(outerRing.length / 200));
        const sampledRing = outerRing.filter((_, i) => i % step === 0);

        const meshPoints: [number, number, number][] = [];
        const borderPts: THREE.Vector3[] = [];

        for (const coord of sampledRing) {
          const p = geoToMeshPos(coord[1], coord[0], bounds, terrain, exaggeration, meshW, meshH);
          if (p) {
            meshPoints.push([p[0], p[1] + 0.08, p[2]]);
            borderPts.push(new THREE.Vector3(p[0], p[1] + 0.09, p[2]));
          }
        }

        if (meshPoints.length < 3) continue;

        // Close border loop
        borderPts.push(borderPts[0].clone());

        const verts = fanTriangulate(meshPoints);
        if (verts.length > 0) allFillVerts.push(...verts);
        allBorderPts.push(...borderPts);

        // Track largest ring for label placement
        if (outerRing.length > bestRingLen) {
          bestRingLen = outerRing.length;
          bestCentroid = centroid(outerRing);
        }
      }

      if (allFillVerts.length === 0 || !bestCentroid) continue;

      const labelP = geoToMeshPos(bestCentroid[1], bestCentroid[0], bounds, terrain, exaggeration, meshW, meshH);
      if (!labelP) continue;

      result.push({
        name,
        nameRu,
        color,
        value,
        fillVertices: new Float32Array(allFillVerts),
        borderPoints: allBorderPts,
        labelPos: [labelP[0], labelP[1] + 0.4, labelP[2]],
      });
    }

    return result;
  }, [geojson, terrain, exaggeration, activeYear]);

  const handleClick = useCallback((name: string) => {
    setSelectedRegion(prev => prev === name ? null : name);
  }, []);

  if (regions.length === 0) return null;

  return (
    <group>
      {regions.map((r, i) => {
        const fillGeo = new THREE.BufferGeometry();
        fillGeo.setAttribute('position', new THREE.Float32BufferAttribute(r.fillVertices, 3));
        fillGeo.computeVertexNormals();

        const borderGeo = new THREE.BufferGeometry().setFromPoints(r.borderPoints);

        return (
          <group key={`region-${i}`}>
            <mesh
              geometry={fillGeo}
              onClick={(e) => { e.stopPropagation(); handleClick(r.name); }}
              onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { document.body.style.cursor = 'auto'; }}
            >
              <meshStandardMaterial color={r.color} opacity={0.6} transparent side={THREE.DoubleSide} />
            </mesh>

            <primitive object={new THREE.Line(borderGeo, new THREE.LineBasicMaterial({ color: '#ffffff', opacity: 0.6, transparent: true }))} />

            {selectedRegion === r.name && (
              <Html position={r.labelPos} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
                <div style={{
                  background: 'rgba(0,0,0,0.9)',
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  border: `2px solid ${r.color}`,
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                }}>
                  <div>{r.name}</div>
                  <div style={{ fontSize: '10px', opacity: 0.7 }}>{r.nameRu}</div>
                  <div style={{ fontSize: '11px', marginTop: '2px', color: r.color }}>
                    Sewage: {r.value !== null ? `${r.value.toFixed(1)}%` : 'N/A'} ({activeYear})
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
