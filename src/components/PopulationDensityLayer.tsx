import { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';
import { fromArrayBuffer } from 'geotiff';

interface PopulationDensityLayerProps {
  terrain: TerrainData;
  exaggeration: number;
  onDataLoaded?: (data: PopData | null) => void;
}

export interface PopData {
  width: number;
  height: number;
  values: Float32Array | Float64Array;
  bounds: GeoBounds;
  noDataValue: number | null;
  maxVal: number;
}

/** Look up population density at a given lon/lat. Returns null if no data. */
export function samplePopulation(popData: PopData | null, lon: number, lat: number): number | null {
  if (!popData) return null;
  const { width, height, values, bounds, noDataValue } = popData;
  const u = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
  const v = (bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat);
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  const px = Math.min(Math.floor(u * (width - 1)), width - 1);
  const py = Math.min(Math.floor(v * (height - 1)), height - 1);
  const val = values[py * width + px];
  if (noDataValue !== null && val === noDataValue) return null;
  if (isNaN(val) || val < 0) return null;
  return val;
}

/** Viridis-inspired color ramp: dark purple → blue → teal → green → yellow */
export function popDensityColor(val: number, maxVal: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, Math.log1p(val) / Math.log1p(maxVal)));
  // Viridis approximation
  const r = Math.min(1, Math.max(0, -0.05 + t * 0.1 + t * t * 1.2));
  const g = Math.min(1, Math.max(0, 0.03 + t * 0.85));
  const b = Math.min(1, Math.max(0, 0.33 + t * 0.3 - t * t * 0.55));
  return [r, g, b];
}

// Better viridis with specific stops
function viridisColor(t: number): [number, number, number] {
  // 5-stop viridis: 0=dark purple, 0.25=blue, 0.5=teal, 0.75=green, 1.0=yellow
  const stops: [number, number, number][] = [
    [0.267, 0.004, 0.329],  // dark purple
    [0.282, 0.141, 0.458],  // indigo
    [0.127, 0.357, 0.525],  // blue-teal
    [0.133, 0.553, 0.420],  // teal-green
    [0.478, 0.733, 0.220],  // green
    [0.993, 0.906, 0.144],  // yellow
  ];
  const n = stops.length - 1;
  const idx = Math.min(Math.floor(t * n), n - 1);
  const frac = t * n - idx;
  const a = stops[idx];
  const b = stops[idx + 1];
  return [
    a[0] + (b[0] - a[0]) * frac,
    a[1] + (b[1] - a[1]) * frac,
    a[2] + (b[2] - a[2]) * frac,
  ];
}

function loadPopulationTiff(): Promise<PopData> {
  return fetch('/data/population_density.tif')
    .then(r => r.arrayBuffer())
    .then(async buf => {
      const tiff = await fromArrayBuffer(buf);
      const image = await tiff.getImage();
      const fullW = image.getWidth();
      const fullH = image.getHeight();

      const width = fullW;
      const height = fullH;

      const rasters = await image.readRasters({ resampleMethod: 'nearest' });
      const values = rasters[0] as Float32Array | Float64Array;

      const fd = image.getFileDirectory() as any;
      const noDataValue = fd.GDAL_NODATA ? parseFloat(String(fd.GDAL_NODATA)) : null;

      let bounds: GeoBounds;
      try {
        const bbox = image.getBoundingBox();
        bounds = { minLon: bbox[0], minLat: bbox[1], maxLon: bbox[2], maxLat: bbox[3] };
      } catch {
        const origin = image.getOrigin();
        const res = image.getResolution();
        bounds = {
          minLon: origin[0],
          maxLon: origin[0] + fullW * Math.abs(res[0]),
          maxLat: origin[1],
          minLat: origin[1] - fullH * Math.abs(res[1]),
        };
      }

      let maxVal = 0;
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (noDataValue !== null && v === noDataValue) continue;
        if (isNaN(v) || v < 0) continue;
        if (v > maxVal) maxVal = v;
      }

      return { width, height, values, bounds, noDataValue, maxVal };
    });
}

const PopulationDensityLayer = ({ terrain, exaggeration, onDataLoaded }: PopulationDensityLayerProps) => {
  const [popData, setPopData] = useState<PopData | null>(null);

  useEffect(() => {
    loadPopulationTiff()
      .then(data => {
        setPopData(data);
        onDataLoaded?.(data);
      })
      .catch(err => {
        console.warn('Pop density load failed:', err);
        onDataLoaded?.(null);
      });
  }, []);

  const mesh = useMemo(() => {
    if (!popData || !terrain.bounds) return null;

    const { width: tw, height: th, elevations, minElevation, maxElevation, noDataValue: tNoData } = terrain;
    const tb = terrain.bounds;
    const elevRange = maxElevation - minElevation || 1;
    const maxH = 10 * (exaggeration / 100);
    const meshW = 10;
    const meshH = 10 * (th / tw);

    const { width: pw, height: ph, values, bounds: pb, noDataValue: pNoData, maxVal } = popData;
    if (maxVal <= 0) return null;

    const gw = pw;
    const gh = ph;

    const positions: number[] = [];
    const colors: number[] = [];
    const alphas: number[] = [];
    const indices: number[] = [];
    const valid: boolean[] = [];

    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const pidx = j * pw + i;
        const val = values[pidx];

        const isND = (pNoData !== null && val === pNoData) || isNaN(val) || val < 0 || val === 0;

        // Geo coords of this pop pixel
        const lon = pb.minLon + (i / (pw - 1)) * (pb.maxLon - pb.minLon);
        const lat = pb.maxLat - (j / (ph - 1)) * (pb.maxLat - pb.minLat);

        // Map to terrain mesh coords
        const u = (lon - tb.minLon) / (tb.maxLon - tb.minLon);
        const vt = (tb.maxLat - lat) / (tb.maxLat - tb.minLat);

        if (u < 0 || u > 1 || vt < 0 || vt > 1) {
          valid.push(false);
          positions.push(0, 0, 0);
          colors.push(0, 0, 0, 0);
          continue;
        }

        // Sample terrain elevation
        const tx = Math.min(Math.floor(u * (tw - 1)), tw - 1);
        const ty = Math.min(Math.floor(vt * (th - 1)), th - 1);
        let elev = elevations[ty * tw + tx];
        if ((tNoData !== null && elev === tNoData) || isNaN(elev) || elev <= -9999) {
          elev = minElevation;
        }

        const normElev = (elev - minElevation) / elevRange;
        const x = (u - 0.5) * meshW;
        const y = (0.5 - vt) * meshH;
        const z = normElev * maxH + 0.02;

        positions.push(x, y, z);
        valid.push(!isND);

        if (isND) {
          colors.push(0, 0, 0, 0); // fully transparent
        } else {
          const t = Math.min(1, Math.log1p(val) / Math.log1p(maxVal));
          const [cr, cg, cb] = viridisColor(t);
          colors.push(cr, cg, cb, 0.85);
        }
      }
    }

    // Build triangle indices, skip faces touching any no-data vertex
    for (let j = 0; j < gh - 1; j++) {
      for (let i = 0; i < gw - 1; i++) {
        const a = j * gw + i;
        const b = a + 1;
        const c = a + gw;
        const d = c + 1;
        if (valid[a] && valid[b] && valid[c]) indices.push(a, b, c);
        if (valid[b] && valid[d] && valid[c]) indices.push(b, d, c);
      }
    }

    if (indices.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }, [popData, terrain, exaggeration]);

  if (!mesh) return null;

  return (
    <mesh geometry={mesh} rotation={[-Math.PI / 2, 0, 0]}>
      <meshBasicMaterial vertexColors transparent side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
};

export default PopulationDensityLayer;
