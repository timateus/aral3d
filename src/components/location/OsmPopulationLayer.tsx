import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { GeoBounds, TerrainData } from '@/lib/geotiff-loader';

interface Props {
  terrain: TerrainData;
  exaggeration: number;
  bounds: GeoBounds;
  dataUrl?: string;
}

interface Place { lon: number; lat: number; population: number; name: string | null }

const _cache = new Map<string, Place[]>();

function parseElements(data: any): Place[] {
  const places: Place[] = [];
  const placeWeights: Record<string, number> = {
    city: 100000, town: 15000, village: 1500, hamlet: 200,
    suburb: 5000, neighbourhood: 1000, isolated_dwelling: 5, farm: 20,
  };
  for (const el of data.elements || []) {
    const lon = el.lon ?? el.center?.lon;
    const lat = el.lat ?? el.center?.lat;
    if (typeof lon !== 'number' || typeof lat !== 'number') continue;
    const t = el.tags || {};
    let pop = 0;
    if (t.population) pop = parseFloat(t.population) || 0;
    if (!pop && t.place && placeWeights[t.place]) pop = placeWeights[t.place];
    if (!pop && t.building) pop = 3;
    if (pop <= 0) continue;
    places.push({ lon, lat, population: pop, name: t.name ?? null });
  }
  return places;
}

async function fetchStatic(url: string): Promise<Place[]> {
  const hit = _cache.get(url);
  if (hit) return hit;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Static ${res.status}`);
  const parsed = parseElements(await res.json());
  _cache.set(url, parsed);
  return parsed;
}

async function fetchOsmPlaces(b: GeoBounds): Promise<Place[]> {
  const key = `${b.minLon.toFixed(4)},${b.minLat.toFixed(4)},${b.maxLon.toFixed(4)},${b.maxLat.toFixed(4)}`;
  const hit = _cache.get(key);
  if (hit) return hit;
  const bbox = `${b.minLat},${b.minLon},${b.maxLat},${b.maxLon}`;
  const q = `[out:json][timeout:30];
    (
      node["population"](${bbox});
      node["place"~"city|town|village|hamlet|suburb|neighbourhood|isolated_dwelling|farm"](${bbox});
    );
    out center 500;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: new URLSearchParams({ data: q }),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const places = parseElements(await res.json());
  _cache.set(key, places);
  return places;
}

/**
 * Population density visualization based on OSM tags. Works at any bbox by
 * fetching from Overpass. Renders extruded hex-like cylinders whose height
 * and color encode local population (log-scaled).
 */
const OsmPopulationLayer = ({ terrain, exaggeration, bounds }: Props) => {
  const [places, setPlaces] = useState<Place[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOsmPlaces(bounds)
      .then((p) => { if (!cancelled) setPlaces(p); })
      .catch((e) => { console.warn('OSM places fetch failed', e); if (!cancelled) setPlaces([]); });
    return () => { cancelled = true; };
  }, [bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat]);

  const mesh = useMemo(() => {
    if (!places || places.length === 0) return null;
    const meshW = 10;
    const meshH = 10 * (terrain.height / terrain.width);
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const maxH = 10 * (exaggeration / 100);
    const maxPop = places.reduce((m, p) => Math.max(m, p.population), 0);
    if (maxPop <= 0) return null;

    const geo = new THREE.CylinderGeometry(0.04, 0.04, 1, 6);
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.6,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9,
    });
    const im = new THREE.InstancedMesh(geo, material, places.length);
    const colorAttr = new THREE.InstancedBufferAttribute(new Float32Array(places.length * 3), 3);
    im.instanceColor = colorAttr;

    const dummy = new THREE.Object3D();
    let idx = 0;
    for (const p of places) {
      const nx = (p.lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
      const ny = (p.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1) continue;
      const x = (nx - 0.5) * meshW;
      const z = -((ny - 0.5) * meshH);
      const px = Math.floor(nx * (terrain.width - 1));
      const py = Math.floor((1 - ny) * (terrain.height - 1));
      let e = terrain.elevations[py * terrain.width + px] ?? terrain.minElevation;
      if (isNaN(e)) e = terrain.minElevation;
      const baseY = ((e - terrain.minElevation) / elevRange) * maxH;

      const t = Math.log1p(p.population) / Math.log1p(maxPop);
      const h = Math.max(0.05, t * maxH * 0.5);

      dummy.position.set(x, baseY + h / 2, z);
      dummy.scale.set(1, h, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      im.setMatrixAt(idx, dummy.matrix);

      // Yellow -> red ramp
      const r = 1.0;
      const g = 1.0 - t * 0.85;
      const b = 0.1 * (1 - t);
      colorAttr.setXYZ(idx, r, g, b);
      idx++;
    }
    im.count = idx;
    im.instanceMatrix.needsUpdate = true;
    colorAttr.needsUpdate = true;
    return im;
  }, [places, terrain, exaggeration, bounds]);

  if (!mesh) return null;
  return <primitive object={mesh} />;
};

export default OsmPopulationLayer;
