import { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';
import { fromArrayBuffer } from 'geotiff';

interface PopulationDensityLayerProps {
  terrain: TerrainData;
  exaggeration: number;
  onDataLoaded?: (data: PopData | null) => void;
  hexSize?: number;       // 0.05 – 0.5 in mesh units
  hexHeightExag?: number; // 0 – 5 multiplier
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

// Viridis color stops
function viridisColor(t: number): [number, number, number] {
  const stops: [number, number, number][] = [
    [0.267, 0.004, 0.329],
    [0.282, 0.141, 0.458],
    [0.127, 0.357, 0.525],
    [0.133, 0.553, 0.420],
    [0.478, 0.733, 0.220],
    [0.993, 0.906, 0.144],
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

      return { width: fullW, height: fullH, values, bounds, noDataValue, maxVal };
    });
}

/** Convert axial hex coords to pixel (flat-top) center */
function hexToPixel(q: number, r: number, size: number): [number, number] {
  const x = size * (3 / 2 * q);
  const y = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return [x, y];
}

/** Convert pixel to axial hex coords (flat-top) */
function pixelToHex(px: number, py: number, size: number): [number, number] {
  const q = (2 / 3 * px) / size;
  const r = (-1 / 3 * px + Math.sqrt(3) / 3 * py) / size;
  return [q, r];
}

function axialRound(q: number, r: number): [number, number] {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);
  const qDiff = Math.abs(rq - q);
  const rDiff = Math.abs(rr - r);
  const sDiff = Math.abs(rs - s);
  if (qDiff > rDiff && qDiff > sDiff) rq = -rr - rs;
  else if (rDiff > sDiff) rr = -rq - rs;
  return [rq, rr];
}

/** Build a flat-top hexagon geometry with given size and height (extruded prism) */
function buildHexGeometry(size: number, height: number): THREE.BufferGeometry {
  const verts: number[] = [];
  const indices: number[] = [];

  // 6 outer vertices on top, 6 on bottom, + 2 centers
  const topCenter = 0;
  const botCenter = 1;
  // top ring: 2..7, bot ring: 8..13
  verts.push(0, height, 0); // top center
  verts.push(0, 0, 0);      // bot center

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const x = size * Math.cos(angle);
    const z = size * Math.sin(angle);
    verts.push(x, height, z); // top ring
  }
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const x = size * Math.cos(angle);
    const z = size * Math.sin(angle);
    verts.push(x, 0, z); // bot ring
  }

  // Top face
  for (let i = 0; i < 6; i++) {
    indices.push(topCenter, 2 + i, 2 + (i + 1) % 6);
  }
  // Bottom face
  for (let i = 0; i < 6; i++) {
    indices.push(botCenter, 8 + (i + 1) % 6, 8 + i);
  }
  // Side faces
  for (let i = 0; i < 6; i++) {
    const t1 = 2 + i;
    const t2 = 2 + (i + 1) % 6;
    const b1 = 8 + i;
    const b2 = 8 + (i + 1) % 6;
    indices.push(t1, b1, t2);
    indices.push(t2, b1, b2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

interface HexBin {
  q: number;
  r: number;
  cx: number; // mesh x
  cy: number; // mesh y (mapped from geo)
  totalPop: number;
  count: number;
  baseZ: number; // terrain elevation z
}

const PopulationDensityLayer = ({ terrain, exaggeration, onDataLoaded, hexSize = 0.15, hexHeightExag = 1.0 }: PopulationDensityLayerProps) => {
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

  const meshGroup = useMemo(() => {
    if (!popData || !terrain.bounds) return null;

    const { width: tw, height: th, elevations, minElevation, maxElevation, noDataValue: tNoData } = terrain;
    const tb = terrain.bounds;
    const elevRange = maxElevation - minElevation || 1;
    const maxH = 10 * (exaggeration / 100);
    const meshW = 10;
    const meshH = 10 * (th / tw);

    const { width: pw, height: ph, values, bounds: pb, noDataValue: pNoData, maxVal } = popData;
    if (maxVal <= 0) return null;

    // Bin population pixels into hexagons
    const bins = new Map<string, HexBin>();

    for (let j = 0; j < ph; j++) {
      for (let i = 0; i < pw; i++) {
        const val = values[j * pw + i];
        const isND = (pNoData !== null && val === pNoData) || isNaN(val) || val < 0 || val === 0;
        if (isND) continue;

        const lon = pb.minLon + (i / (pw - 1)) * (pb.maxLon - pb.minLon);
        const lat = pb.maxLat - (j / (ph - 1)) * (pb.maxLat - pb.minLat);

        const u = (lon - tb.minLon) / (tb.maxLon - tb.minLon);
        const vt = (tb.maxLat - lat) / (tb.maxLat - tb.minLat);
        if (u < 0 || u > 1 || vt < 0 || vt > 1) continue;

        const mx = (u - 0.5) * meshW;
        const my = (0.5 - vt) * meshH;

        // Convert mesh coords to hex axial
        const [hq, hr] = pixelToHex(mx, my, hexSize);
        const [rq, rr] = axialRound(hq, hr);
        const key = `${rq},${rr}`;

        // Sample terrain elevation
        const tx = Math.min(Math.floor(u * (tw - 1)), tw - 1);
        const ty = Math.min(Math.floor(vt * (th - 1)), th - 1);
        let elev = elevations[ty * tw + tx];
        if ((tNoData !== null && elev === tNoData) || isNaN(elev) || elev <= -9999) {
          elev = minElevation;
        }
        const normElev = (elev - minElevation) / elevRange;
        const baseZ = normElev * maxH;

        if (bins.has(key)) {
          const bin = bins.get(key)!;
          bin.totalPop += val;
          bin.count += 1;
          bin.baseZ = Math.max(bin.baseZ, baseZ); // use highest terrain point in hex
        } else {
          const [cx, cy] = hexToPixel(rq, rr, hexSize);
          bins.set(key, { q: rq, r: rr, cx, cy, totalPop: val, count: 1, baseZ });
        }
      }
    }

    if (bins.size === 0) return null;

    // Find max average density for normalization
    let maxAvg = 0;
    for (const bin of bins.values()) {
      const avg = bin.totalPop / bin.count;
      if (avg > maxAvg) maxAvg = avg;
    }
    if (maxAvg <= 0) return null;

    // Build instanced mesh
    const hexGeo = buildHexGeometry(hexSize * 0.9, 1); // unit height, will scale
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.5,
      metalness: 0.2,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    });

    const instanceCount = bins.size;
    const instancedMesh = new THREE.InstancedMesh(hexGeo, material, instanceCount);
    const colorAttr = new THREE.InstancedBufferAttribute(new Float32Array(instanceCount * 3), 3);
    instancedMesh.instanceColor = colorAttr;

    const dummy = new THREE.Object3D();
    let idx = 0;
    const maxPopHeight = maxH * 0.4 * hexHeightExag;

    for (const bin of bins.values()) {
      const avg = bin.totalPop / bin.count;
      const t = Math.min(1, Math.log1p(avg) / Math.log1p(maxAvg));
      const h = Math.max(0.01, t * maxPopHeight);

      dummy.position.set(bin.cx, bin.baseZ + 0.01, bin.cy);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(idx, dummy.matrix);

      const [cr, cg, cb] = viridisColor(t);
      colorAttr.setXYZ(idx, cr, cg, cb);
      idx++;
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
    colorAttr.needsUpdate = true;

    return instancedMesh;
  }, [popData, terrain, exaggeration, hexSize, hexHeightExag]);

  if (!meshGroup) return null;

  return (
    <primitive object={meshGroup} rotation={[-Math.PI / 2, 0, 0]} />
  );
};

export default PopulationDensityLayer;
