import { useEffect, useMemo, useState } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { TerrainData } from '@/lib/geotiff-loader';

interface PlacesLayerProps {
  terrain: TerrainData;
  exaggeration: number;
}

interface Place {
  name: string;
  lat: number;
  lon: number;
  kind: 'city' | 'town' | 'village';
  population: number | null;
}

const KIND_STYLE: Record<Place['kind'], { color: string; size: number; distFactor: number; fontSize: number; minSepDeg: number }> = {
  city:    { color: '#ffd24a', size: 0.09, distFactor: 6, fontSize: 12, minSepDeg: 0.0 },
  town:    { color: '#7bd3ff', size: 0.055, distFactor: 4, fontSize: 10, minSepDeg: 0.20 },
  village: { color: '#cfd8dc', size: 0.03, distFactor: 2.5, fontSize: 9, minSepDeg: 0.12 },
};

// In-memory cache keyed by bbox so toggling doesn't re-fetch.
const cache = new Map<string, Place[]>();

function bboxKey(b: { minLon: number; maxLon: number; minLat: number; maxLat: number }) {
  return `${b.minLon.toFixed(2)},${b.minLat.toFixed(2)},${b.maxLon.toFixed(2)},${b.maxLat.toFixed(2)}`;
}

async function fetchPlaces(bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number }): Promise<Place[]> {
  const k = bboxKey(bounds);
  const hit = cache.get(k);
  if (hit) return hit;

  // Overpass: nodes with place=city|town|village within bbox (south,west,north,east)
  const bbox = `${bounds.minLat},${bounds.minLon},${bounds.maxLat},${bounds.maxLon}`;
  const query = `[out:json][timeout:25];
(
  node["place"="city"](${bbox});
  node["place"="town"](${bbox});
  node["place"="village"](${bbox});
);
out body;`;

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  let json: any = null;
  let lastErr: unknown = null;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      json = await res.json();
      break;
    } catch (e) { lastErr = e; }
  }
  if (!json) {
    console.warn('Places (Overpass) fetch failed:', lastErr);
    return [];
  }

  const places: Place[] = (json.elements || [])
    .filter((el: any) => el.type === 'node' && el.tags?.name)
    .map((el: any) => {
      const popRaw = el.tags?.population;
      const pop = popRaw ? parseInt(String(popRaw).replace(/[^\d]/g, ''), 10) : NaN;
      const kind = (el.tags.place as Place['kind']) || 'village';
      // Prefer English/Latin name when present
      const name: string = el.tags['name:en'] || el.tags['name:uz'] || el.tags['name:ru'] || el.tags.name;
      return { name, lat: el.lat, lon: el.lon, kind, population: Number.isFinite(pop) ? pop : null };
    });

  cache.set(k, places);
  return places;
}

function geoToMeshPos(
  lon: number, lat: number,
  bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  width: number, height: number,
  elevations: Float32Array | Float64Array,
  meshW: number, meshH: number,
  exaggeration: number,
): [number, number, number] {
  const u = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
  const v = (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
  const px = Math.max(0, Math.min(width - 1, Math.floor(u * (width - 1))));
  const py = Math.max(0, Math.min(height - 1, Math.floor((1 - v) * (height - 1))));
  const elev = elevations[py * width + px] ?? 0;
  const x = (u - 0.5) * meshW;
  const z = -(v - 0.5) * meshH;
  const y = (elev / 800) * exaggeration;
  return [x, y, z];
}

export default function PlacesLayer({ terrain, exaggeration }: PlacesLayerProps) {
  const [places, setPlaces] = useState<Place[]>([]);

  useEffect(() => {
    if (!terrain?.bounds) return;
    let cancelled = false;
    fetchPlaces(terrain.bounds).then((p) => { if (!cancelled) setPlaces(p); });
    return () => { cancelled = true; };
  }, [terrain?.bounds?.minLon, terrain?.bounds?.maxLon, terrain?.bounds?.minLat, terrain?.bounds?.maxLat]);

  const meshW = 10;
  const meshH = 10 * (terrain.height / terrain.width);

  const markers = useMemo(() => {
    if (!places.length) return [];
    const inside = places.filter((p) =>
      p.lon >= terrain.bounds.minLon && p.lon <= terrain.bounds.maxLon &&
      p.lat >= terrain.bounds.minLat && p.lat <= terrain.bounds.maxLat
    );
    // Sort: cities first, then by population desc (so larger places win labels)
    inside.sort((a, b) => {
      const order = { city: 0, town: 1, village: 2 } as const;
      const o = order[a.kind] - order[b.kind];
      if (o !== 0) return o;
      return (b.population || 0) - (a.population || 0);
    });
    // Greedy dedup: drop labels of lower-priority places too close to a kept one
    const kept: Place[] = [];
    for (const p of inside) {
      const sep = KIND_STYLE[p.kind].minSepDeg;
      if (sep > 0) {
        const tooClose = kept.some((k) => {
          // approximate degree distance (lat-weighted)
          const dLat = k.lat - p.lat;
          const dLon = (k.lon - p.lon) * Math.cos((p.lat * Math.PI) / 180);
          return Math.hypot(dLat, dLon) < sep;
        });
        if (tooClose) continue;
      }
      kept.push(p);
      if (kept.length >= 60) break;
    }
    return kept.map((p) => ({
      ...p,
      pos: geoToMeshPos(
        p.lon, p.lat,
        terrain.bounds, terrain.width, terrain.height,
        terrain.elevations, meshW, meshH, exaggeration,
      ),
    }));
  }, [places, terrain, exaggeration]);

  return (
    <group>
      {markers.map((m, i) => {
        const s = KIND_STYLE[m.kind];
        return (
          <group key={`${m.name}-${i}`} position={m.pos}>
            {/* Marker dot */}
            <mesh position={[0, 0.18, 0]}>
              <sphereGeometry args={[s.size, 12, 12]} />
              <meshStandardMaterial color={s.color} emissive={s.color} emissiveIntensity={0.7} />
            </mesh>
            {/* Stem */}
            <mesh position={[0, 0.09, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.18, 6]} />
              <meshStandardMaterial color="#ffffff" opacity={0.55} transparent />
            </mesh>
            {/* Label — distanceFactor caps apparent screen size; bigger = smaller on screen */}
            <Html
              center
              distanceFactor={s.distFactor}
              position={[0, 0.32, 0]}
              zIndexRange={[100, 0]}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              <div
                style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: `${s.fontSize}px`,
                  fontWeight: m.kind === 'city' ? 700 : 500,
                  letterSpacing: '0.04em',
                  textTransform: m.kind === 'city' ? 'uppercase' : 'none',
                  color: '#fff',
                  textShadow: '0 0 4px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,0.9)',
                  whiteSpace: 'nowrap',
                  padding: '1px 4px',
                }}
              >
                {m.name}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
