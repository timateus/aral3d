import { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { fromArrayBuffer } from 'geotiff';
import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';

interface LandcoverLayerProps {
  terrain: TerrainData;
  exaggeration: number;
  visibleClasses?: Set<number>;
  onDataLoaded?: (data: LandcoverRasterData | null) => void;
  onAvailableClasses?: (classes: number[]) => void;
}

export interface LandcoverRasterData {
  width: number;
  height: number;
  values: Uint8Array | Uint16Array | Float32Array | Float64Array;
  bounds: GeoBounds;
}

// GlobCover legend (values 1–22, 0 = no data) — high-contrast distinct colors
const CLASS_COLORS: Record<number, string> = {
  1: '#1a9641',   // Tree Cover, broadleaved, evergreen — vivid green
  2: '#006837',   // Tree Cover, broadleaved, deciduous, closed — dark green
  3: '#a6d96a',   // Tree Cover, broadleaved, deciduous, open — lime
  4: '#1b7837',   // Tree Cover, needle-leaved, evergreen — forest green
  5: '#78c679',   // Tree Cover, needle-leaved, deciduous — mid green
  6: '#41ab5d',   // Tree Cover, mixed leaf type — teal green
  7: '#00bcd4',   // Tree Cover, regularly flooded, fresh water — cyan
  8: '#006064',   // Tree Cover, regularly flooded, saline water — dark teal
  9: '#b2df8a',   // Mosaic: Tree cover / Other natural vegetation — pale lime
  10: '#e31a1c',  // Tree Cover, burnt — red
  11: '#ff7f00',  // Shrub Cover, closed-open, evergreen — orange
  12: '#e6ab02',  // Shrub Cover, closed-open, deciduous — gold
  13: '#c4e600',  // Herbaceous Cover, closed-open — yellow-green
  14: '#f0e442',  // Sparse Herbaceous or sparse Shrub Cover — bright yellow
  15: '#7570b3',  // Regularly flooded Shrub and/or Herbaceous Cover — purple
  16: '#e7298a',  // Cultivated and managed areas (Cropland) — hot pink
  17: '#d95f02',  // Mosaic: Cropland / Tree Cover / Other natural vegetation — burnt orange
  18: '#e6ab02',  // Mosaic: Cropland / Shrub and/or Herbaceous cover — amber
  19: '#c2b280',  // Bare Areas — tan
  20: '#2b83ba',  // Water Bodies — blue
  21: '#f0f0f0',  // Snow and Ice — near white
  22: '#d62728',  // Artificial surfaces (Urban) — crimson
};

const CLASS_NAMES: Record<number, string> = {
  1: 'Tree Cover, broadleaved, evergreen',
  2: 'Tree Cover, broadleaved, deciduous, closed',
  3: 'Tree Cover, broadleaved, deciduous, open',
  4: 'Tree Cover, needle-leaved, evergreen',
  5: 'Tree Cover, needle-leaved, deciduous',
  6: 'Tree Cover, mixed leaf type',
  7: 'Tree Cover, regularly flooded, fresh water',
  8: 'Tree Cover, regularly flooded, saline water',
  9: 'Mosaic: Tree cover / Other natural vegetation',
  10: 'Tree Cover, burnt',
  11: 'Shrub Cover, closed-open, evergreen',
  12: 'Shrub Cover, closed-open, deciduous',
  13: 'Herbaceous Cover, closed-open',
  14: 'Sparse Herbaceous or sparse Shrub Cover',
  15: 'Regularly flooded Shrub and/or Herbaceous Cover',
  16: 'Cultivated and managed areas (Cropland)',
  17: 'Mosaic: Cropland / Tree Cover / Other natural vegetation',
  18: 'Mosaic: Cropland / Shrub and/or Herbaceous cover',
  19: 'Bare Areas',
  20: 'Water Bodies',
  21: 'Snow and Ice',
  22: 'Artificial surfaces (Urban)',
};

export { CLASS_COLORS, CLASS_NAMES };

export function sampleLandcover(data: LandcoverRasterData | null, lon: number, lat: number): { classId: number; className: string; color: string } | null {
  if (!data) return null;
  const { bounds, width, height, values } = data;
  const nx = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
  const ny = (bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat);
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
  const px = Math.floor(nx * (width - 1));
  const py = Math.floor(ny * (height - 1));
  const val = values[py * width + px];
  if (val === 0) return null;
  return {
    classId: val,
    className: CLASS_NAMES[val] || `Class ${val}`,
    color: CLASS_COLORS[val] || `hsl(${(val * 137) % 360}, 60%, 50%)`,
  };
}

function getClassColor(val: number): [number, number, number] | null {
  if (val === 0) return null;
  const hex = CLASS_COLORS[val];
  if (!hex) {
    const r = ((val * 137) % 256) / 255;
    const g = ((val * 97 + 50) % 256) / 255;
    const b = ((val * 223 + 100) % 256) / 255;
    return [r, g, b];
  }
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

// Module-level cache for landcover data
let _cachedLcData: LandcoverRasterData | null = null;
let _cachedLcClasses: number[] | null = null;
let _lcFetchPromise: Promise<{ data: LandcoverRasterData; classes: number[] }> | null = null;

export function isLandcoverCached(): boolean { return _cachedLcData !== null; }

function fetchLandcoverData(): Promise<{ data: LandcoverRasterData; classes: number[] }> {
  if (_cachedLcData && _cachedLcClasses) return Promise.resolve({ data: _cachedLcData, classes: _cachedLcClasses });
  if (_lcFetchPromise) return _lcFetchPromise;
  _lcFetchPromise = (async () => {
    const resp = await fetch('/data/landcover.tif');
    const buf = await resp.arrayBuffer();
    const tiff = await fromArrayBuffer(buf);
    const image = await tiff.getImage();
    const fw = image.getWidth();
    const fh = image.getHeight();
    const maxDim = 512;
    const sx = Math.max(1, Math.ceil(fw / maxDim));
    const sy = Math.max(1, Math.ceil(fh / maxDim));
    const w = Math.floor(fw / sx);
    const h = Math.floor(fh / sy);
    const rasters = await image.readRasters({ width: w, height: h, resampleMethod: 'nearest' });
    const values = rasters[0] as any;
    let bounds: GeoBounds | null = null;
    try {
      const bbox = image.getBoundingBox();
      if (bbox && bbox.length === 4) bounds = { minLon: bbox[0], minLat: bbox[1], maxLon: bbox[2], maxLat: bbox[3] };
    } catch {}
    if (!bounds) {
      try {
        const o = image.getOrigin();
        const r = image.getResolution();
        if (o && r) bounds = { minLon: o[0], maxLon: o[0] + fw * Math.abs(r[0]), maxLat: o[1], minLat: o[1] - fh * Math.abs(r[1]) };
      } catch {}
    }
    if (!bounds) throw new Error('No bounds');
    const unique = new Set<number>();
    for (let i = 0; i < values.length; i++) { if (values[i] !== 0) unique.add(values[i]); }
    const sortedClasses = Array.from(unique).sort((a, b) => a - b);
    console.log('Landcover loaded:', { w, h, bounds, uniqueClasses: sortedClasses });
    const data: LandcoverRasterData = { width: w, height: h, values, bounds };
    _cachedLcData = data;
    _cachedLcClasses = sortedClasses;
    return { data, classes: sortedClasses };
  })();
  return _lcFetchPromise;
}

const LandcoverLayer = ({ terrain, exaggeration, visibleClasses, onDataLoaded, onAvailableClasses }: LandcoverLayerProps) => {
  const [lcData, setLcData] = useState<LandcoverRasterData | null>(_cachedLcData);

  useEffect(() => {
    if (_cachedLcData && _cachedLcClasses) {
      setLcData(_cachedLcData);
      onAvailableClasses?.(_cachedLcClasses);
      onDataLoaded?.(_cachedLcData);
      return;
    }
    fetchLandcoverData().then(({ data, classes }) => {
      setLcData(data);
      onAvailableClasses?.(classes);
      onDataLoaded?.(data);
    }).catch(e => console.warn('Landcover load failed:', e));
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => { onDataLoaded?.(null); };
  }, [onDataLoaded]);

  const mesh = useMemo(() => {
    if (!lcData || !terrain.bounds) return null;

    const tb = terrain.bounds;
    const lb = lcData.bounds;
    const meshW = 10;
    const meshH = meshW * (terrain.height / terrain.width);
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const maxMeshH = 10 * (exaggeration / 100);

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    let vertIdx = 0;

    for (let py = 0; py < lcData.height - 1; py++) {
      for (let px = 0; px < lcData.width - 1; px++) {
        const val = lcData.values[py * lcData.width + px];
        if (val === 0) continue;
        if (visibleClasses && !visibleClasses.has(val)) continue;

        const color = getClassColor(val);
        if (!color) continue;

        // Get the 4 corners of this pixel in geo coords
        const corners = [
          [px, py], [px + 1, py], [px + 1, py + 1], [px, py + 1]
        ];

        const verts: [number, number, number][] = [];
        for (const [cpx, cpy] of corners) {
          const lon = lb.minLon + (cpx / lcData.width) * (lb.maxLon - lb.minLon);
          const lat = lb.maxLat - (cpy / lcData.height) * (lb.maxLat - lb.minLat);

          // Convert to terrain mesh coords
          const nx = (lon - tb.minLon) / (tb.maxLon - tb.minLon);
          const ny = (lat - tb.minLat) / (tb.maxLat - tb.minLat);
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

          verts.push([x, zH + 0.02, -planeY]);
        }

        // Add quad as two triangles
        for (const v of verts) {
          positions.push(v[0], v[1], v[2]);
          colors.push(color[0], color[1], color[2]);
        }
        indices.push(vertIdx, vertIdx + 1, vertIdx + 2);
        indices.push(vertIdx, vertIdx + 2, vertIdx + 3);
        vertIdx += 4;
      }
    }

    if (positions.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }, [lcData, terrain, exaggeration, visibleClasses]);

  if (!mesh) return null;

  return (
    <mesh geometry={mesh}>
      <meshBasicMaterial vertexColors transparent opacity={0.85} side={THREE.DoubleSide} />
    </mesh>
  );
};

export default LandcoverLayer;
