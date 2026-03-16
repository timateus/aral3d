import { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { fromArrayBuffer } from 'geotiff';
import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';

interface LandcoverLayerProps {
  terrain: TerrainData;
  exaggeration: number;
  visibleClasses?: Set<number>;
}

interface LandcoverData {
  width: number;
  height: number;
  values: Uint8Array | Uint16Array | Float32Array | Float64Array;
  bounds: GeoBounds;
  classes: Map<number, string>;
}

// Distinct colors for landcover classes
const CLASS_COLORS: Record<number, string> = {
  10: '#a6cee3',  // Cropland, rainfed
  11: '#b2df8a',  // Herbaceous cover
  12: '#33a02c',  // Tree or shrub cover
  20: '#fb9a99',  // Cropland, irrigated
  30: '#e31a1c',  // Mosaic cropland
  40: '#fdbf6f',  // Mosaic natural veg
  50: '#1f78b4',  // Tree cover, broadleaved, evergreen
  60: '#ff7f00',  // Tree cover, broadleaved, deciduous
  61: '#cab2d6',  // Tree cover, broadleaved, deciduous, closed
  62: '#6a3d9a',  // Tree cover, broadleaved, deciduous, open
  70: '#8dd3c7',  // Tree cover, needleleaved, evergreen
  71: '#ffffb3',  // Tree cover, needleleaved, evergreen, closed
  72: '#bebada',  // Tree cover, needleleaved, evergreen, open
  80: '#fb8072',  // Tree cover, needleleaved, deciduous
  81: '#80b1d3',  // Tree cover, needleleaved, deciduous, closed
  82: '#fdb462',  // Tree cover, needleleaved, deciduous, open
  90: '#b3de69',  // Tree cover, mixed
  100: '#fccde5', // Mosaic tree and shrub
  110: '#d9d9d9', // Mosaic herbaceous
  120: '#bc80bd', // Shrubland
  121: '#ccebc5', // Shrubland evergreen
  122: '#ffed6f', // Shrubland deciduous
  130: '#e5d8bd', // Grassland
  140: '#c7e9c0', // Lichens and mosses
  150: '#fdd0a2', // Sparse vegetation
  151: '#fdae6b', // Sparse tree
  152: '#fd8d3c', // Sparse shrub
  153: '#e6550d', // Sparse herbaceous
  160: '#31a354', // Tree cover, flooded, fresh
  170: '#006d2c', // Tree cover, flooded, saline
  180: '#74c476', // Shrub/herb, flooded
  190: '#de2d26', // Urban
  200: '#d2b48c', // Bare areas
  201: '#a0522d', // Consolidated bare
  202: '#deb887', // Unconsolidated bare
  210: '#4292c6', // Water bodies
  220: '#f0f0f0', // Permanent snow/ice
};

const CLASS_NAMES: Record<number, string> = {
  10: 'Cropland, rainfed',
  11: 'Herbaceous cover',
  12: 'Tree/shrub cover',
  20: 'Cropland, irrigated',
  30: 'Mosaic cropland',
  40: 'Mosaic natural vegetation',
  50: 'Broadleaved evergreen',
  60: 'Broadleaved deciduous',
  61: 'Broadleaved deciduous (closed)',
  62: 'Broadleaved deciduous (open)',
  70: 'Needleleaved evergreen',
  71: 'Needleleaved evergreen (closed)',
  72: 'Needleleaved evergreen (open)',
  80: 'Needleleaved deciduous',
  81: 'Needleleaved deciduous (closed)',
  82: 'Needleleaved deciduous (open)',
  90: 'Mixed tree cover',
  100: 'Mosaic tree/shrub',
  110: 'Mosaic herbaceous',
  120: 'Shrubland',
  121: 'Shrubland evergreen',
  122: 'Shrubland deciduous',
  130: 'Grassland',
  140: 'Lichens/mosses',
  150: 'Sparse vegetation',
  151: 'Sparse tree',
  152: 'Sparse shrub',
  153: 'Sparse herbaceous',
  160: 'Flooded tree (fresh)',
  170: 'Flooded tree (saline)',
  180: 'Flooded shrub/herb',
  190: 'Urban',
  200: 'Bare areas',
  201: 'Consolidated bare',
  202: 'Unconsolidated bare',
  210: 'Water bodies',
  220: 'Snow/ice',
};

export { CLASS_COLORS, CLASS_NAMES };

function getClassColor(val: number): [number, number, number] | null {
  if (val === 0) return null; // no data
  const hex = CLASS_COLORS[val];
  if (!hex) {
    // Generate a deterministic color for unknown classes
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

const LandcoverLayer = ({ terrain, exaggeration, visibleClasses }: LandcoverLayerProps) => {
  const [lcData, setLcData] = useState<LandcoverData | null>(null);

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

        // Collect unique classes
        const classes = new Map<number, string>();
        for (let i = 0; i < values.length; i++) {
          const v = values[i];
          if (v !== 0 && !classes.has(v)) {
            classes.set(v, CLASS_NAMES[v] || `Class ${v}`);
          }
        }

        setLcData({ width: w, height: h, values, bounds, classes });
      } catch (e) {
        console.warn('Landcover load failed:', e);
      }
    })();
  }, []);

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
