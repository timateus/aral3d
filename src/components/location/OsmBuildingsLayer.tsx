import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { GeoBounds, TerrainData } from '@/lib/geotiff-loader';

interface Props {
  terrain: TerrainData;
  exaggeration: number;
  bounds: GeoBounds;
}

interface Building { coords: [number, number][]; height: number }

const _cache = new Map<string, Building[]>();

async function fetchOsmBuildings(b: GeoBounds): Promise<Building[]> {
  const key = `${b.minLon.toFixed(4)},${b.minLat.toFixed(4)},${b.maxLon.toFixed(4)},${b.maxLat.toFixed(4)}`;
  const hit = _cache.get(key);
  if (hit) return hit;
  const bbox = `${b.minLat},${b.minLon},${b.maxLat},${b.maxLon}`;
  const q = `[out:json][timeout:30];
    (
      way["building"](${bbox});
      relation["building"](${bbox});
    );
    out geom;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: new URLSearchParams({ data: q }),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const data = await res.json();
  const out: Building[] = [];
  for (const el of data.elements || []) {
    const parseH = (t: any): number => {
      if (!t) return 6;
      if (t.height) { const n = parseFloat(t.height); if (isFinite(n)) return n; }
      if (t['building:levels']) { const n = parseFloat(t['building:levels']); if (isFinite(n)) return n * 3; }
      return 6;
    };
    if (el.type === 'way' && Array.isArray(el.geometry) && el.geometry.length >= 3) {
      out.push({
        coords: el.geometry.map((g: any) => [g.lon, g.lat] as [number, number]),
        height: parseH(el.tags),
      });
    } else if (el.type === 'relation' && Array.isArray(el.members)) {
      const h = parseH(el.tags);
      for (const m of el.members) {
        if (m.type === 'way' && m.role === 'outer' && Array.isArray(m.geometry) && m.geometry.length >= 3) {
          out.push({ coords: m.geometry.map((g: any) => [g.lon, g.lat] as [number, number]), height: h });
        }
      }
    }
  }
  _cache.set(key, out);
  return out;
}

const OsmBuildingsLayer = ({ terrain, exaggeration, bounds }: Props) => {
  const [buildings, setBuildings] = useState<Building[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOsmBuildings(bounds)
      .then((b) => { if (!cancelled) setBuildings(b); })
      .catch((e) => { console.warn('OSM buildings fetch failed', e); if (!cancelled) setBuildings([]); });
    return () => { cancelled = true; };
  }, [bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat]);

  const group = useMemo(() => {
    if (!buildings || buildings.length === 0) return null;
    const meshW = 10;
    const meshH = 10 * (terrain.height / terrain.width);
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const maxH = 10 * (exaggeration / 100);
    // Scene units per meter (approx) — matches the vertical scaling.
    const unitsPerMeter = maxH / elevRange;

    const material = new THREE.MeshStandardMaterial({
      color: '#e8ac4a',
      roughness: 0.75,
      metalness: 0.05,
    });

    const g = new THREE.Group();
    for (const b of buildings) {
      const shape = new THREE.Shape();
      let baseElev = terrain.minElevation;
      let baseSet = false;
      let localMinElev = Infinity;
      const projected: [number, number][] = [];
      for (const [lon, lat] of b.coords) {
        const nx = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
        const ny = (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
        if (nx < 0 || nx > 1 || ny < 0 || ny > 1) { projected.length = 0; break; }
        const x = (nx - 0.5) * meshW;
        const z = -((ny - 0.5) * meshH);
        projected.push([x, z]);
        const px = Math.floor(nx * (terrain.width - 1));
        const py = Math.floor((1 - ny) * (terrain.height - 1));
        let e = terrain.elevations[py * terrain.width + px];
        if (!isFinite(e)) e = terrain.minElevation;
        if (e < localMinElev) localMinElev = e;
        baseSet = true;
      }
      if (projected.length < 3 || !baseSet) continue;
      baseElev = localMinElev;

      shape.moveTo(projected[0][0], projected[0][1]);
      for (let i = 1; i < projected.length; i++) shape.lineTo(projected[i][0], projected[i][1]);
      shape.closePath();

      const heightUnits = Math.max(0.02, b.height * unitsPerMeter);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: heightUnits, bevelEnabled: false });
      // Shape is in XZ plane (x, z=y-of-shape). Extrude goes along +Z of shape space.
      // Rotate so extrusion goes up world +Y and shape lays flat on XZ.
      geo.rotateX(-Math.PI / 2);
      const baseY = ((baseElev - terrain.minElevation) / elevRange) * maxH;
      geo.translate(0, baseY, 0);
      const mesh = new THREE.Mesh(geo, material);
      g.add(mesh);
    }
    return g;
  }, [buildings, terrain, exaggeration, bounds]);

  useEffect(() => () => {
    if (!group) return;
    group.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); });
  }, [group]);

  if (!group) return null;
  return <primitive object={group} />;
};

export default OsmBuildingsLayer;
