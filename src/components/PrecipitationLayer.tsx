import { useEffect, useState, useMemo } from 'react';
import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';
import { fromArrayBuffer } from 'geotiff';
import * as THREE from 'three';

interface PrecipitationLayerProps {
  terrain: TerrainData;
  exaggeration: number;
}

interface PrecipData {
  width: number;
  height: number;
  values: Float32Array | Float64Array | any;
  bounds: GeoBounds;
  noDataValue: number | null;
  maxVal: number;
  minVal: number;
}

function precipColor(t: number): [number, number, number] {
  // Dry (low) → wet (high): tan → light green → teal → deep blue
  if (t < 0.2) return [0.85, 0.78, 0.6]; // dry tan
  if (t < 0.4) {
    const s = (t - 0.2) / 0.2;
    return [0.85 - s * 0.45, 0.78 + s * 0.12, 0.6 - s * 0.25]; // tan → green
  }
  if (t < 0.6) {
    const s = (t - 0.4) / 0.2;
    return [0.4 - s * 0.2, 0.9 - s * 0.1, 0.35 + s * 0.35]; // green → teal
  }
  if (t < 0.8) {
    const s = (t - 0.6) / 0.2;
    return [0.2 - s * 0.1, 0.8 - s * 0.3, 0.7 + s * 0.15]; // teal → blue
  }
  const s = (t - 0.8) / 0.2;
  return [0.1 - s * 0.05, 0.5 - s * 0.2, 0.85 + s * 0.1]; // blue → deep blue
}

const PrecipitationLayer = ({ terrain, exaggeration }: PrecipitationLayerProps) => {
  const [data, setData] = useState<PrecipData | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch('/data/precipitation.tif');
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
            maxLon: origin[0] + fw * Math.abs(res[0]),
            maxLat: origin[1],
            minLat: origin[1] - fh * Math.abs(res[1]),
          };
        }

        let mn = Infinity, mx = -Infinity;
        for (let i = 0; i < values.length; i++) {
          const v = values[i];
          if (noDataValue !== null && v === noDataValue) continue;
          if (isNaN(v) || !isFinite(v)) continue;
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
        if (mn === mx) mx = mn + 1;

        console.log('Precipitation loaded:', { w, h, bounds, min: mn, max: mx, noDataValue });
        setData({ width: w, height: h, values, bounds, noDataValue, maxVal: mx, minVal: mn });
      } catch (e) {
        console.warn('Precipitation load failed:', e);
      }
    })();
  }, []);

  const geo = useMemo(() => {
    if (!data || !terrain.bounds) return null;

    const tb = terrain.bounds;
    const pb = data.bounds;
    const meshW = 10;
    const meshH = meshW * (terrain.height / terrain.width);
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const maxMeshH = 10 * (exaggeration / 100);
    const range = data.maxVal - data.minVal || 1;

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    let vertIdx = 0;

    for (let py = 0; py < data.height - 1; py++) {
      for (let px = 0; px < data.width - 1; px++) {
        const val = data.values[py * data.width + px];
        if (data.noDataValue !== null && val === data.noDataValue) continue;
        if (isNaN(val) || !isFinite(val)) continue;

        const t = Math.max(0, Math.min(1, (val - data.minVal) / range));
        const color = precipColor(t);

        const corners = [
          [px, py], [px + 1, py], [px + 1, py + 1], [px, py + 1]
        ];

        const verts: [number, number, number][] = [];
        for (const [cpx, cpy] of corners) {
          const lon = pb.minLon + (cpx / data.width) * (pb.maxLon - pb.minLon);
          const lat = pb.maxLat - (cpy / data.height) * (pb.maxLat - pb.minLat);

          const nx = (lon - tb.minLon) / (tb.maxLon - tb.minLon);
          const ny = (lat - tb.minLat) / (tb.maxLat - tb.minLat);
          const x = (nx - 0.5) * meshW;
          const planeY = (ny - 0.5) * meshH;

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

          verts.push([x, zH + 0.03, -planeY]);
        }

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

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }, [data, terrain, exaggeration]);

  if (!geo) return null;

  return (
    <mesh geometry={geo}>
      <meshBasicMaterial vertexColors transparent opacity={0.8} side={THREE.DoubleSide} />
    </mesh>
  );
};

export default PrecipitationLayer;
