import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { useThree } from '@react-three/fiber';
import type { GeoBounds, TerrainData } from '@/lib/geotiff-loader';

interface Props {
  terrain: TerrainData;
  exaggeration: number;
  bounds: GeoBounds;
  /** If set, load OSM water JSON from this static URL instead of hitting Overpass. */
  dataUrl?: string;
}

interface Line { coords: [number, number][]; kind: 'linear' | 'area' }

const _cache = new Map<string, Line[]>();

function parseElements(data: any): Line[] {
  const lines: Line[] = [];
  for (const el of data.elements || []) {
    if (el.type === 'way' && Array.isArray(el.geometry)) {
      const coords = el.geometry.map((g: any) => [g.lon, g.lat] as [number, number]);
      const kind: 'linear' | 'area' = el.tags?.waterway ? 'linear' : 'area';
      lines.push({ coords, kind });
    } else if (el.type === 'relation' && Array.isArray(el.members)) {
      for (const m of el.members) {
        if (m.type === 'way' && Array.isArray(m.geometry)) {
          const coords = m.geometry.map((g: any) => [g.lon, g.lat] as [number, number]);
          lines.push({ coords, kind: 'area' });
        }
      }
    }
  }
  return lines;
}

async function fetchStatic(url: string): Promise<Line[]> {
  const hit = _cache.get(url);
  if (hit) return hit;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Static ${res.status}`);
  const parsed = parseElements(await res.json());
  _cache.set(url, parsed);
  return parsed;
}

async function fetchOsmWater(b: GeoBounds): Promise<Line[]> {
  const key = `${b.minLon.toFixed(4)},${b.minLat.toFixed(4)},${b.maxLon.toFixed(4)},${b.maxLat.toFixed(4)}`;
  const hit = _cache.get(key);
  if (hit) return hit;
  const bbox = `${b.minLat},${b.minLon},${b.maxLat},${b.maxLon}`;
  const q = `[out:json][timeout:30];
    (
      way["waterway"](${bbox});
      way["natural"="water"](${bbox});
      way["landuse"="reservoir"](${bbox});
      relation["natural"="water"](${bbox});
    );
    out geom;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: new URLSearchParams({ data: q }),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const lines = parseElements(await res.json());
  _cache.set(key, lines);
  return lines;
}

const OsmWaterwaysLayer = ({ terrain, exaggeration, bounds, dataUrl }: Props) => {
  const [lines, setLines] = useState<Line[] | null>(null);
  const { size } = useThree();

  useEffect(() => {
    let cancelled = false;
    const p = dataUrl ? fetchStatic(dataUrl) : fetchOsmWater(bounds);
    p.then((l) => { if (!cancelled) setLines(l); })
     .catch((e) => { console.warn('OSM water fetch failed', e); if (!cancelled) setLines([]); });
    return () => { cancelled = true; };
  }, [dataUrl, bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat]);

  const object = useMemo(() => {
    if (!lines || lines.length === 0) return null;
    const meshW = 10;
    const meshH = 10 * (terrain.height / terrain.width);
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const maxHeight = 10 * (exaggeration / 100);
    const lift = Math.max(0.05, maxHeight * 0.015);
    const positions: number[] = [];
    const colors: number[] = [];
    const linearColor = new THREE.Color('#0ea5e9');
    const areaColor = new THREE.Color('#1d4ed8');

    const sampleY = (nx: number, ny: number) => {
      const cx = Math.max(0, Math.min(terrain.width - 1, Math.floor(nx * (terrain.width - 1))));
      const cy = Math.max(0, Math.min(terrain.height - 1, Math.floor((1 - ny) * (terrain.height - 1))));
      let e = terrain.elevations[cy * terrain.width + cx];
      if (!isFinite(e)) e = terrain.minElevation;
      return ((e - terrain.minElevation) / elevRange) * maxHeight + lift;
    };

    for (const l of lines) {
      const col = l.kind === 'linear' ? linearColor : areaColor;
      for (let i = 0; i < l.coords.length - 1; i++) {
        const [lon1, lat1] = l.coords[i];
        const [lon2, lat2] = l.coords[i + 1];
        const nx1 = (lon1 - bounds.minLon) / (bounds.maxLon - bounds.minLon);
        const ny1 = (lat1 - bounds.minLat) / (bounds.maxLat - bounds.minLat);
        const nx2 = (lon2 - bounds.minLon) / (bounds.maxLon - bounds.minLon);
        const ny2 = (lat2 - bounds.minLat) / (bounds.maxLat - bounds.minLat);
        const in1 = nx1 >= 0 && nx1 <= 1 && ny1 >= 0 && ny1 <= 1;
        const in2 = nx2 >= 0 && nx2 <= 1 && ny2 >= 0 && ny2 <= 1;
        if (!in1 && !in2) continue;
        const x1 = (nx1 - 0.5) * meshW;
        const z1 = -((ny1 - 0.5) * meshH);
        const x2 = (nx2 - 0.5) * meshW;
        const z2 = -((ny2 - 0.5) * meshH);
        const y1 = sampleY(nx1, ny1);
        const y2 = sampleY(nx2, ny2);
        positions.push(x1, y1, z1, x2, y2, z2);
        colors.push(col.r, col.g, col.b, col.r, col.g, col.b);
      }
    }
    if (positions.length === 0) return null;
    const geo = new LineSegmentsGeometry();
    geo.setPositions(new Float32Array(positions));
    geo.setColors(new Float32Array(colors));
    const mat = new LineMaterial({
      vertexColors: true,
      linewidth: 4,
      transparent: true,
      opacity: 1,
      depthTest: false,
      resolution: new THREE.Vector2(size.width, size.height),
    });
    const obj = new LineSegments2(geo, mat);
    obj.renderOrder = 10;
    return obj;
  }, [lines, terrain, exaggeration, bounds, size.width, size.height]);

  useEffect(() => {
    return () => {
      if (object) {
        object.geometry.dispose();
        (object.material as LineMaterial).dispose();
      }
    };
  }, [object]);

  if (!object) return null;
  return <primitive object={object} />;
};

export default OsmWaterwaysLayer;
