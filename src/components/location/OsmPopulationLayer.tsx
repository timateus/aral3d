import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { GeoBounds, TerrainData } from '@/lib/geotiff-loader';
import { fetchOverpass } from '@/lib/overpass';

interface Props {
  terrain: TerrainData;
  exaggeration: number;
  /** Bounding box used for the Overpass query (typically larger than terrain). */
  bounds: GeoBounds;
  /** Optional static JSON URL used only if Overpass API fails. */
  fallbackUrl?: string;
  /** 0..1 overlay opacity */
  opacity?: number;
  /** 0..1 splat radius (fraction of shortest bbox side) */
  radius?: number;
  /** 0..3 intensity multiplier */
  intensity?: number;
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
  const bbox = `${b.minLat},${b.minLon},${b.maxLat},${b.maxLon}`;
  const q = `[out:json][timeout:20];
    (
      node["population"](${bbox});
      node["place"~"city|town|village|hamlet|suburb|neighbourhood|isolated_dwelling|farm"](${bbox});
    );
    out center 2000;`;
  const json = await fetchOverpass<any>(q, key);
  const places = parseElements(json);
  _cache.set(key, places);
  return places;
}

// Yellow → orange → red → violet color ramp (heatmap-friendly)
function heatColor(t: number): [number, number, number] {
  // t in 0..1
  const stops: [number, number, number, number][] = [
    [0.00, 1.00, 1.00, 0.60], // pale yellow
    [0.25, 1.00, 0.85, 0.20], // yellow
    [0.55, 1.00, 0.45, 0.10], // orange
    [0.80, 0.95, 0.10, 0.15], // red
    [1.00, 0.55, 0.05, 0.55], // violet-red
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, r0, g0, b0] = stops[i];
    const [t1, r1, g1, b1] = stops[i + 1];
    if (t <= t1) {
      const f = (t - t0) / (t1 - t0 || 1);
      return [r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f];
    }
  }
  const s = stops[stops.length - 1];
  return [s[1], s[2], s[3]];
}

/** Build an RGBA heatmap canvas by additive log-weighted Gaussian splatting. */
function buildHeatmap(
  places: Place[],
  terrainBounds: GeoBounds,
  w: number,
  h: number,
  radiusFrac: number,
  intensity: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // Accumulate scalar densities in a float buffer, then colorize.
  const buf = new Float32Array(w * h);
  const maxPop = Math.max(...places.map((p) => p.population), 1);
  const logMax = Math.log1p(maxPop);
  const shortest = Math.min(w, h);
  const baseR = Math.max(6, shortest * radiusFrac);

  for (const p of places) {
    const nx = (p.lon - terrainBounds.minLon) / (terrainBounds.maxLon - terrainBounds.minLon);
    const ny = (p.lat - terrainBounds.minLat) / (terrainBounds.maxLat - terrainBounds.minLat);
    if (nx < -0.05 || nx > 1.05 || ny < -0.05 || ny > 1.05) continue;
    const cx = nx * (w - 1);
    const cy = (1 - ny) * (h - 1); // north at top of canvas
    const weight = Math.log1p(p.population) / logMax; // 0..1
    // Scale radius mildly with weight so cities are broader than hamlets.
    const rad = baseR * (0.4 + 1.2 * weight);
    const r2 = rad * rad;
    const x0 = Math.max(0, Math.floor(cx - rad));
    const x1 = Math.min(w - 1, Math.ceil(cx + rad));
    const y0 = Math.max(0, Math.floor(cy - rad));
    const y1 = Math.min(h - 1, Math.ceil(cy + rad));
    const amp = weight * intensity;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        // Gaussian falloff
        const g = Math.exp(-3.0 * d2 / r2);
        buf[y * w + x] += g * amp;
      }
    }
  }

  // Normalize buf to 0..1 (soft: divide by 90th percentile-ish max)
  let peak = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] > peak) peak = buf[i];
  if (peak <= 0) return canvas;

  const img = ctx.createImageData(w, h);
  for (let i = 0; i < buf.length; i++) {
    const t = Math.min(1, buf[i] / peak);
    if (t < 0.02) continue;
    const [r, g, b] = heatColor(t);
    const alpha = Math.pow(t, 0.7); // punchy but still transparent at edges
    const j = i * 4;
    img.data[j] = Math.round(r * 255);
    img.data[j + 1] = Math.round(g * 255);
    img.data[j + 2] = Math.round(b * 255);
    img.data[j + 3] = Math.round(alpha * 255);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Draped population-density heatmap. Reuses the terrain surface geometry so
 * the color hugs the relief, with a transparent RGBA texture built from an
 * additive Gaussian splat of OSM `place` nodes.
 */
const OsmPopulationLayer = ({
  terrain, exaggeration, bounds, fallbackUrl,
  opacity = 0.75, radius = 0.05, intensity = 1,
}: Props) => {
  const [places, setPlaces] = useState<Place[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOsmPlaces(bounds)
      .then((pl) => { if (!cancelled) setPlaces(pl); })
      .catch(async (e) => {
        console.warn('OSM places fetch failed', e);
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
  }, [fallbackUrl, bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat]);

  const texture = useMemo(() => {
    if (!places || places.length === 0 || !terrain.bounds) return null;
    // Canvas resolution scaled to terrain aspect
    const W = 512;
    const H = Math.round(512 * (terrain.height / terrain.width));
    const c = buildHeatmap(places, terrain.bounds, W, H, radius, intensity);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [places, terrain, radius, intensity]);

  const geometry = useMemo(() => {
    if (!terrain.bounds) return null;
    const { width: w, height: h, elevations, minElevation, maxElevation, noDataValue } = terrain;
    const elevRange = maxElevation - minElevation || 1;
    const maxHeight = 10 * (exaggeration / 100);
    const positions: number[] = [];
    const uvs: number[] = [];
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let elev = elevations[j * w + i];
        const nd = isNaN(elev) || (noDataValue !== null && elev === noDataValue) || elev <= -9999;
        if (nd) elev = minElevation;
        const normalized = (elev - minElevation) / elevRange;
        const x = (i / (w - 1) - 0.5) * 10;
        const y = (0.5 - j / (h - 1)) * 10 * (h / w);
        const z = normalized * maxHeight + 0.008; // lift slightly to avoid z-fighting
        positions.push(x, y, z);
        uvs.push(i / (w - 1), 1 - j / (h - 1));
      }
    }
    const indices: number[] = [];
    for (let j = 0; j < h - 1; j++) {
      for (let i = 0; i < w - 1; i++) {
        const a = j * w + i, b = a + 1, c = a + w, d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [terrain, exaggeration]);

  if (!texture || !geometry) return null;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={opacity}
          depthWrite={false}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
    </group>
  );
};

export default OsmPopulationLayer;
