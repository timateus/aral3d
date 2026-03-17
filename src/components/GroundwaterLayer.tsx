import { useEffect, useState, useMemo } from 'react';
import { TerrainData } from '@/lib/geotiff-loader';
import * as shapefile from 'shapefile';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

interface GroundwaterLayerProps {
  terrain: TerrainData;
  exaggeration: number;
}

interface GWPoint {
  lon: number;
  lat: number;
  properties: Record<string, any>;
}

function interpolateColor(t: number): [number, number, number] {
  // Deep blue (high water table / shallow) → cyan → yellow → red (deep / low water table)
  if (t < 0.25) {
    const s = t / 0.25;
    return [0, s * 0.8, 1 - s * 0.2]; // deep blue → cyan
  }
  if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    return [s * 0.2, 0.8 + s * 0.2, 0.8 - s * 0.5]; // cyan → green-yellow
  }
  if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    return [0.2 + s * 0.8, 1 - s * 0.3, 0.3 - s * 0.3]; // yellow-green → orange
  }
  const s = (t - 0.75) / 0.25;
  return [1, 0.7 - s * 0.5, s * 0.1]; // orange → red
}

const GroundwaterLayer = ({ terrain, exaggeration }: GroundwaterLayerProps) => {
  const [points, setPoints] = useState<GWPoint[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [shpBuf, dbfBuf] = await Promise.all([
          fetch('/data/groundwater_level.shp').then(r => r.arrayBuffer()),
          fetch('/data/groundwater_level.dbf').then(r => r.arrayBuffer()),
        ]);
        const source = await shapefile.open(shpBuf, dbfBuf);
        const pts: GWPoint[] = [];
        let result = await source.read();
        while (!result.done) {
          const f = result.value;
          if (f.geometry && f.geometry.type === 'Point') {
            pts.push({
              lon: f.geometry.coordinates[0],
              lat: f.geometry.coordinates[1],
              properties: f.properties || {},
            });
          }
          result = await source.read();
        }
        console.log('Groundwater points loaded:', pts.length, pts[0]?.properties);
        setPoints(pts);
      } catch (e) {
        console.warn('Groundwater shapefile load failed:', e);
      }
    })();
  }, []);

  const { mesh, valueKey, minVal, maxVal } = useMemo(() => {
    if (!points.length || !terrain.bounds) return { mesh: null, valueKey: '', minVal: 0, maxVal: 1 };

    const tb = terrain.bounds;
    const meshW = 10;
    const meshH = meshW * (terrain.height / terrain.width);
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const maxMeshH = 10 * (exaggeration / 100);

    // Find a numeric property to visualize
    const props0 = points[0].properties;
    let vKey = '';
    for (const k of Object.keys(props0)) {
      if (typeof props0[k] === 'number' && !k.toLowerCase().includes('id') && !k.toLowerCase().includes('fid')) {
        vKey = k;
        break;
      }
    }
    if (!vKey) {
      // fallback: first numeric
      for (const k of Object.keys(props0)) {
        if (typeof props0[k] === 'number') { vKey = k; break; }
      }
    }

    let mn = Infinity, mx = -Infinity;
    for (const p of points) {
      const v = vKey ? (p.properties[vKey] as number) : 0;
      if (isFinite(v)) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
    }
    if (mn === mx) mx = mn + 1;

    const dummy = new THREE.Object3D();
    const geo = new THREE.SphereGeometry(0.06, 8, 6);
    const instancedMesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: false }), points.length);
    const color = new THREE.Color();

    let count = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const nx = (p.lon - tb.minLon) / (tb.maxLon - tb.minLon);
      const ny = (p.lat - tb.minLat) / (tb.maxLat - tb.minLat);
      if (nx < -0.1 || nx > 1.1 || ny < -0.1 || ny > 1.1) continue;

      const x = (nx - 0.5) * meshW;
      const planeY = (ny - 0.5) * meshH;

      // Sample terrain elevation
      let zH = 0;
      if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) {
        const tpx = Math.floor(nx * (terrain.width - 1));
        const tpy = Math.floor((1 - ny) * (terrain.height - 1));
        const idx = tpy * terrain.width + tpx;
        let elev = terrain.elevations[idx] || terrain.minElevation;
        if (terrain.noDataValue !== null && elev === terrain.noDataValue) elev = terrain.minElevation;
        const norm = (elev - terrain.minElevation) / elevRange;
        zH = norm * maxMeshH;
      }

      const v = vKey ? (p.properties[vKey] as number) : 0;
      const t = isFinite(v) ? (v - mn) / (mx - mn) : 0.5;
      const [r, g, b] = interpolateColor(t);
      color.setRGB(r, g, b);

      dummy.position.set(x, zH + 0.08, -planeY);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(count, dummy.matrix);
      instancedMesh.setColorAt(count, color);
      count++;
    }

    instancedMesh.count = count;
    instancedMesh.instanceMatrix.needsUpdate = true;
    if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

    return { mesh: instancedMesh, valueKey: vKey, minVal: mn, maxVal: mx };
  }, [points, terrain, exaggeration]);

  if (!mesh) return null;

  return (
    <primitive object={mesh} />
  );
};

export default GroundwaterLayer;
