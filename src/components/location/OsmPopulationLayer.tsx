import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { GeoBounds, TerrainData } from '@/lib/geotiff-loader';
import { cacheGet, cacheSet } from '@/lib/browser-cache';
import { fetchOverpass } from '@/lib/overpass';

interface Props {
  terrain: TerrainData;
  exaggeration: number;
  bounds: GeoBounds;
  /** Optional static JSON URL (used as a fallback if Overpass fails). */
  dataUrl?: string;
  /** Optional static JSON URL used only if Overpass API fails. */
  fallbackUrl?: string;
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
  const key = `osm-pop:${b.minLon.toFixed(4)},${b.minLat.toFixed(4)},${b.maxLon.toFixed(4)},${b.maxLat.toFixed(4)}`;
  const mem = _cache.get(key);
  if (mem) return mem;
  const disk = await cacheGet<Place[]>(key);
  if (disk && Array.isArray(disk) && disk.length) {
    _cache.set(key, disk);
    return disk;
  }
  const bbox = `${b.minLat},${b.minLon},${b.maxLat},${b.maxLon}`;
  const q = `[out:json][timeout:45];
    (
      node["population"](${bbox});
      node["place"~"city|town|village|hamlet|suburb|neighbourhood|isolated_dwelling|farm"](${bbox});
    );
    out center 2000;`;
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  let lastErr: unknown = null;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: q }) });
      if (!res.ok) { lastErr = new Error(`Overpass ${res.status}`); continue; }
      const places = parseElements(await res.json());
      _cache.set(key, places);
      cacheSet(key, places).catch(() => {});
      return places;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('Overpass failed');
}

/**
 * Population density visualization based on OSM tags. Prefers a live Overpass
 * query so any location works out of the box; falls back to a static JSON if
 * the API is unavailable. Results are cached in IndexedDB per bbox.
 */
const OsmPopulationLayer = ({ terrain, exaggeration, bounds, dataUrl, fallbackUrl }: Props) => {
  const [places, setPlaces] = useState<Place[] | null>(null);


  useEffect(() => {
    let cancelled = false;
    const primary = dataUrl ? fetchStatic(dataUrl) : fetchOsmPlaces(bounds);
    primary
      .then((pl) => { if (!cancelled) setPlaces(pl); })
      .catch(async (e) => {
        console.warn('OSM places primary fetch failed', e);
        if (fallbackUrl) {
          try {
            const pl = await fetchStatic(fallbackUrl);
            if (!cancelled) setPlaces(pl);
            return;
          } catch (e2) {
            console.warn('OSM places fallback failed', e2);
          }
        }
        if (!cancelled) setPlaces([]);
      });
    return () => { cancelled = true; };
  }, [dataUrl, fallbackUrl, bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat]);


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
