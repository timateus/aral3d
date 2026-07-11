import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { PMTiles } from 'pmtiles';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import type { GeoBounds, TerrainData } from '@/lib/geotiff-loader';

interface Props {
  terrain: TerrainData;
  exaggeration: number;
  bounds: GeoBounds;
}

interface Building { coords: [number, number][]; height: number }

// Overture Maps Foundation — public PMTiles archive of the `buildings` theme.
// Updated monthly; version pinned by URL. Attribution: © Overture Maps
// Foundation (see https://overturemaps.org/attribution/).
const OVERTURE_BUILDINGS_URL =
  'https://tiles.overturemaps.org/2026-06-17.0/buildings.pmtiles';

let _pmtiles: PMTiles | null = null;
function getPmtiles() {
  if (!_pmtiles) _pmtiles = new PMTiles(OVERTURE_BUILDINGS_URL);
  return _pmtiles;
}

const _cache = new Map<string, Building[]>();

function lon2tile(lon: number, z: number) { return Math.floor(((lon + 180) / 360) * Math.pow(2, z)); }
function lat2tile(lat: number, z: number) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z));
}

async function fetchOvertureBuildings(b: GeoBounds): Promise<Building[]> {
  const key = `${b.minLon.toFixed(4)},${b.minLat.toFixed(4)},${b.maxLon.toFixed(4)},${b.maxLat.toFixed(4)}`;
  const hit = _cache.get(key);
  if (hit) return hit;

  // Overture buildings tileset carries geometries at ~z14–15. Fetch a small
  // grid of z=14 tiles covering the bbox.
  const z = 14;
  const x0 = lon2tile(b.minLon, z);
  const x1 = lon2tile(b.maxLon, z);
  const y0 = lat2tile(b.maxLat, z);
  const y1 = lat2tile(b.minLat, z);
  const pm = getPmtiles();
  const out: Building[] = [];

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      let tile;
      try {
        tile = await pm.getZxy(z, tx, ty);
      } catch (e) {
        continue;
      }
      if (!tile) continue;
      const vt = new VectorTile(new Pbf(new Uint8Array(tile.data)));
      const layer = vt.layers['building'] ?? vt.layers['buildings'] ?? Object.values(vt.layers)[0];
      if (!layer) continue;
      // Tile → lon/lat converter
      const n = Math.pow(2, z);
      const west = (tx / n) * 360 - 180;
      const east = ((tx + 1) / n) * 360 - 180;
      const latRad0 = Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n)));
      const latRad1 = Math.atan(Math.sinh(Math.PI * (1 - (2 * (ty + 1)) / n)));
      const north = (latRad0 * 180) / Math.PI;
      const south = (latRad1 * 180) / Math.PI;

      for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i);
        // MVT geometry as arrays of rings in tile coords (0..extent).
        const geom = feat.loadGeometry();
        const props: any = feat.properties;
        let h = 6;
        if (props.height != null && isFinite(+props.height)) h = +props.height;
        else if (props.num_floors != null && isFinite(+props.num_floors)) h = +props.num_floors * 3;
        else if (props.roof_height != null && isFinite(+props.roof_height)) h = +props.roof_height + 3;
        const extent = (layer as any).extent ?? 4096;

        for (const ring of geom) {
          if (ring.length < 3) continue;
          const coords: [number, number][] = ring.map((p: { x: number; y: number }) => {
            const lon = west + (p.x / extent) * (east - west);
            const lat = north + (p.y / extent) * (south - north);
            return [lon, lat] as [number, number];
          });
          // Clip to bbox — cheap containment check on first vertex
          const [lon0, lat0] = coords[0];
          if (lon0 < b.minLon - 0.001 || lon0 > b.maxLon + 0.001 || lat0 < b.minLat - 0.001 || lat0 > b.maxLat + 0.001) continue;
          out.push({ coords, height: h });
        }
      }
    }
  }
  _cache.set(key, out);
  return out;
}

const OvertureBuildingsLayer = ({ terrain, exaggeration, bounds }: Props) => {
  const [buildings, setBuildings] = useState<Building[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOvertureBuildings(bounds)
      .then((b) => { if (!cancelled) setBuildings(b); })
      .catch((e) => { console.warn('Overture buildings fetch failed', e); if (!cancelled) setBuildings([]); });
    return () => { cancelled = true; };
  }, [bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat]);

  const group = useMemo(() => {
    if (!buildings || buildings.length === 0) return null;
    const meshW = 10;
    const meshH = 10 * (terrain.height / terrain.width);
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const maxH = 10 * (exaggeration / 100);
    const unitsPerMeter = maxH / elevRange;

    const material = new THREE.MeshStandardMaterial({
      color: '#e8ac4a',
      roughness: 0.75,
      metalness: 0.05,
    });

    const g = new THREE.Group();
    for (const b of buildings) {
      const shape = new THREE.Shape();
      let localMinElev = Infinity;
      const projected: [number, number][] = [];
      let inside = false;
      for (const [lon, lat] of b.coords) {
        const nx = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
        const ny = (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
        if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) inside = true;
        const x = (nx - 0.5) * meshW;
        const z = -((ny - 0.5) * meshH);
        projected.push([x, z]);
        const px = Math.max(0, Math.min(terrain.width - 1, Math.floor(nx * (terrain.width - 1))));
        const py = Math.max(0, Math.min(terrain.height - 1, Math.floor((1 - ny) * (terrain.height - 1))));
        let e = terrain.elevations[py * terrain.width + px];
        if (!isFinite(e)) e = terrain.minElevation;
        if (e < localMinElev) localMinElev = e;
      }
      if (projected.length < 3 || !inside) continue;

      shape.moveTo(projected[0][0], projected[0][1]);
      for (let i = 1; i < projected.length; i++) shape.lineTo(projected[i][0], projected[i][1]);
      shape.closePath();

      const heightUnits = Math.max(0.02, b.height * unitsPerMeter);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: heightUnits, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      const baseY = ((localMinElev - terrain.minElevation) / elevRange) * maxH;
      geo.translate(0, baseY, 0);
      g.add(new THREE.Mesh(geo, material));
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

export default OvertureBuildingsLayer;
