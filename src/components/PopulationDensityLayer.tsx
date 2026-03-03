import { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';
import { fromArrayBuffer } from 'geotiff';

interface PopulationDensityLayerProps {
  terrain: TerrainData;
  exaggeration: number;
}

interface PopData {
  width: number;
  height: number;
  values: Float32Array | Float64Array;
  bounds: GeoBounds;
  noDataValue: number | null;
  maxVal: number;
}

function loadPopulationTiff(): Promise<PopData> {
  return fetch('/data/population_density.tif')
    .then(r => r.arrayBuffer())
    .then(async buf => {
      const tiff = await fromArrayBuffer(buf);
      const image = await tiff.getImage();
      const fullW = image.getWidth();
      const fullH = image.getHeight();

      const maxDim = 256;
      const scaleX = Math.max(1, Math.ceil(fullW / maxDim));
      const scaleY = Math.max(1, Math.ceil(fullH / maxDim));
      const width = Math.floor(fullW / scaleX);
      const height = Math.floor(fullH / scaleY);

      const rasters = await image.readRasters({ width, height, resampleMethod: 'nearest' });
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

const PopulationDensityLayer = ({ terrain, exaggeration }: PopulationDensityLayerProps) => {
  const [popData, setPopData] = useState<PopData | null>(null);

  useEffect(() => {
    loadPopulationTiff().then(setPopData).catch(err => console.warn('Pop density load failed:', err));
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

    // Build a plane matching the population raster extent, projected onto terrain
    // We'll sample the pop raster at lower res for performance
    const stepI = Math.max(1, Math.floor(pw / 128));
    const stepJ = Math.max(1, Math.floor(ph / 128));
    const gw = Math.floor(pw / stepI);
    const gh = Math.floor(ph / stepJ);

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const valid: boolean[] = [];

    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const si = i * stepI;
        const sj = j * stepJ;
        const pidx = sj * pw + si;
        let val = values[pidx];

        const isND = (pNoData !== null && val === pNoData) || isNaN(val) || val < 0;

        // Geo coords of this pop pixel
        const lon = pb.minLon + (si / (pw - 1)) * (pb.maxLon - pb.minLon);
        const lat = pb.maxLat - (sj / (ph - 1)) * (pb.maxLat - pb.minLat);

        // Map to terrain mesh coords
        const u = (lon - tb.minLon) / (tb.maxLon - tb.minLon);
        const v = (tb.maxLat - lat) / (tb.maxLat - tb.minLat);

        if (u < 0 || u > 1 || v < 0 || v > 1) {
          valid.push(false);
          positions.push(0, 0, 0);
          colors.push(0, 0, 0);
          continue;
        }

        // Sample terrain elevation
        const tx = Math.min(Math.floor(u * (tw - 1)), tw - 1);
        const ty = Math.min(Math.floor(v * (th - 1)), th - 1);
        let elev = elevations[ty * tw + tx];
        if ((tNoData !== null && elev === tNoData) || isNaN(elev) || elev <= -9999) {
          elev = minElevation;
        }

        const normElev = (elev - minElevation) / elevRange;
        const x = (u - 0.5) * meshW;
        const z = -(v - 0.5) * meshH;
        const y = normElev * maxH + 0.02; // slight offset above terrain

        positions.push(x, y, z);
        valid.push(!isND);

        if (isND || val <= 0) {
          colors.push(0, 0, 0); // transparent via alpha
        } else {
          // Color ramp: low=yellow, mid=orange, high=red, very high=magenta
          const t = Math.min(1, Math.log1p(val) / Math.log1p(maxVal));
          const r = Math.min(1, 0.3 + t * 0.7);
          const g = Math.max(0, 0.8 - t * 0.8);
          const b = t > 0.7 ? (t - 0.7) / 0.3 * 0.6 : 0;
          colors.push(r, g, b);
        }
      }
    }

    // Build triangle indices, skip faces with invalid verts
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
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }, [popData, terrain, exaggeration]);

  if (!mesh) return null;

  return (
    <mesh geometry={mesh} rotation={[-Math.PI / 2, 0, 0]}>
      <meshBasicMaterial vertexColors transparent opacity={0.65} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
};

export default PopulationDensityLayer;
