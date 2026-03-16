import { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { fromArrayBuffer } from 'geotiff';
import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';

interface LandcoverLayerProps {
  terrain: TerrainData;
  exaggeration: number;
  visibleClasses?: Set<number>;
  onDataLoaded?: (data: LandcoverRasterData | null) => void;
}

export interface LandcoverRasterData {
  width: number;
  height: number;
  values: Uint8Array | Uint16Array | Float32Array | Float64Array;
  bounds: GeoBounds;
}

// GlobCover legend (values 1–22, 0 = no data)
const CLASS_COLORS: Record<number, string> = {
  1: '#006400',   // Tree Cover, broadleaved, evergreen
  2: '#228b22',   // Tree Cover, broadleaved, deciduous, closed
  3: '#32cd32',   // Tree Cover, broadleaved, deciduous, open
  4: '#2e8b57',   // Tree Cover, needle-leaved, evergreen
  5: '#3cb371',   // Tree Cover, needle-leaved, deciduous
  6: '#66cdaa',   // Tree Cover, mixed leaf type
  7: '#00ced1',   // Tree Cover, regularly flooded, fresh water
  8: '#008b8b',   // Tree Cover, regularly flooded, saline water
  9: '#9acd32',   // Mosaic: Tree cover / Other natural vegetation
  10: '#8b0000',  // Tree Cover, burnt
  11: '#a0522d',  // Shrub Cover, closed-open, evergreen
  12: '#cd853f',  // Shrub Cover, closed-open, deciduous
  13: '#bdb76b',  // Herbaceous Cover, closed-open
  14: '#d2b48c',  // Sparse Herbaceous or sparse Shrub Cover
  15: '#5f9ea0',  // Regularly flooded Shrub and/or Herbaceous Cover
  16: '#daa520',  // Cultivated and managed areas (Cropland)
  17: '#f4a460',  // Mosaic: Cropland / Tree Cover / Other natural vegetation
  18: '#ffd700',  // Mosaic: Cropland / Shrub and/or Herbaceous cover
  19: '#c2b280',  // Bare Areas
  20: '#4169e1',  // Water Bodies
  21: '#f0f8ff',  // Snow and Ice
  22: '#dc143c',  // Artificial surfaces (Urban)
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

const LandcoverLayer = ({ terrain, exaggeration, visibleClasses, onDataLoaded }: LandcoverLayerProps) => {
  const [lcData, setLcData] = useState<LandcoverRasterData | null>(null);

  useEffect(() => {
    (async () => {
      try {
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

        // Get bounds
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
        if (!bounds) return;

        // Log bounds + unique classes for verification
        const unique = new Set<number>();
        for (let i = 0; i < values.length; i++) {
          if (values[i] !== 0) unique.add(values[i]);
        }
        console.log('Landcover loaded:', { w, h, bounds, uniqueClasses: Array.from(unique).sort((a, b) => a - b) });
        console.log('Terrain bounds:', terrain.bounds);

        const data: LandcoverRasterData = { width: w, height: h, values, bounds };
        setLcData(data);
        onDataLoaded?.(data);
      } catch (e) {
        console.warn('Landcover load failed:', e);
      }
    })();
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
