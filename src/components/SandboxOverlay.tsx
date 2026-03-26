import { useMemo } from 'react';
import * as THREE from 'three';
import type { TerrainData } from '@/lib/geotiff-loader';
import type { SandboxSimState } from '@/lib/sandbox-simulation';

interface SandboxOverlayProps {
  terrain: TerrainData;
  exaggeration: number;
  simState: SandboxSimState;
  renderKey: number;
}

function getColor(w: number, s: number, f: number, p: number, l: number): [number, number, number] {
  let r = 0, g = 0, b = 0, tw = 0;
  if (w > 0.01) { const wt = Math.min(w, 5); r += 0.12 * wt; g += 0.56 * wt; b += 1.0 * wt; tw += wt; }
  if (s > 0.01) { const wt = Math.min(s, 5); r += 0.82 * wt; g += 0.71 * wt; b += 0.55 * wt; tw += wt; }
  if (f > 0) { const wt = f / 20; r += 1.0 * wt; g += 0.27 * wt; b += 0.0 * wt; tw += wt; }
  if (p > 0.01) { const wt = Math.min(p, 5); r += 0.13 * wt; g += 0.77 * wt; b += 0.37 * wt; tw += wt; }
  if (l > 0.01) { const wt = Math.min(l, 5); r += 1.0 * wt; g += 0.4 * wt; b += 0.0 * wt; tw += wt; }
  if (tw > 0) { r /= tw; g /= tw; b /= tw; }
  return [r, g, b];
}

export default function SandboxOverlay({ terrain, exaggeration, simState, renderKey }: SandboxOverlayProps) {
  const geometry = useMemo(() => {
    if (!simState) return null;

    const { width, height } = terrain;
    const { waterDepth, sandDepth, fireIntensity, plantDensity, lavaDepth, effectiveElev } = simState;
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const maxHeight = 10 * (exaggeration / 100);

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const isActive = (idx: number) => {
      return waterDepth[idx] > 0.01 || sandDepth[idx] > 0.01 ||
        fireIntensity[idx] > 0 || plantDensity[idx] > 0.01 || lavaDepth[idx] > 0.01;
    };

    const toXY = (i: number, j: number) => {
      const x = (i / (width - 1) - 0.5) * 10;
      const y = (0.5 - j / (height - 1)) * 10 * (height / width);
      return [x, y];
    };

    const toZ = (elev: number, depth: number) => {
      return ((elev + depth - terrain.minElevation) / elevRange) * maxHeight;
    };

    // Top face vertices — one per active pixel
    const topVertexMap = new Map<number, number>();

    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        const idx = j * width + i;
        if (!isActive(idx)) continue;

        const [cr, cg, cb] = getColor(waterDepth[idx], sandDepth[idx], fireIntensity[idx], plantDensity[idx], lavaDepth[idx]);
        const topDepth = Math.max(waterDepth[idx], lavaDepth[idx]);
        const [x, y] = toXY(i, j);
        const z = toZ(effectiveElev[idx], topDepth) + 0.02;

        const vIdx = positions.length / 3;
        topVertexMap.set(idx, vIdx);
        positions.push(x, y, z);
        colors.push(cr, cg, cb);
      }
    }

    if (positions.length === 0) return null;

    // Top face triangles
    for (let j = 0; j < height - 1; j++) {
      for (let i = 0; i < width - 1; i++) {
        const a = topVertexMap.get(j * width + i);
        const b2 = topVertexMap.get(j * width + i + 1);
        const c = topVertexMap.get((j + 1) * width + i);
        const d = topVertexMap.get((j + 1) * width + i + 1);

        if (a !== undefined && b2 !== undefined && c !== undefined) {
          indices.push(a, b2, c);
        }
        if (b2 !== undefined && d !== undefined && c !== undefined) {
          indices.push(b2, d, c);
        }
      }
    }

    // Side faces — at boundaries between active and inactive pixels
    const addSideQuad = (
      fi1: number, fj1: number, fi2: number, fj2: number,
      idx: number
    ) => {
      const [cr, cg, cb] = getColor(waterDepth[idx], sandDepth[idx], fireIntensity[idx], plantDensity[idx], lavaDepth[idx]);
      const dr = cr * 0.7, dg = cg * 0.7, db = cb * 0.7;

      const topDepth = Math.max(waterDepth[idx], lavaDepth[idx]);
      const topZ = toZ(effectiveElev[idx], topDepth) + 0.02;
      const baseZ = toZ(effectiveElev[idx], 0);

      const [x1, y1] = toXY(fi1, fj1);
      const [x2, y2] = toXY(fi2, fj2);

      const base = positions.length / 3;
      positions.push(x1, y1, topZ);  colors.push(dr, dg, db);
      positions.push(x2, y2, topZ);  colors.push(dr, dg, db);
      positions.push(x1, y1, baseZ); colors.push(dr, dg, db);
      positions.push(x2, y2, baseZ); colors.push(dr, dg, db);

      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    };

    // Check 4 directions for each active pixel and add side quads
    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        const idx = j * width + i;
        if (!isActive(idx)) continue;

        // left
        if (i === 0 || !isActive(j * width + (i - 1))) {
          addSideQuad(i - 0.5, j - 0.5, i - 0.5, j + 0.5, idx);
        }
        // right
        if (i === width - 1 || !isActive(j * width + (i + 1))) {
          addSideQuad(i + 0.5, j - 0.5, i + 0.5, j + 0.5, idx);
        }
        // top
        if (j === 0 || !isActive((j - 1) * width + i)) {
          addSideQuad(i - 0.5, j - 0.5, i + 0.5, j - 0.5, idx);
        }
        // bottom
        if (j === height - 1 || !isActive((j + 1) * width + i)) {
          addSideQuad(i - 0.5, j + 0.5, i + 0.5, j + 0.5, idx);
        }
      }
    }

    if (indices.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrain, exaggeration, simState, renderKey]);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      roughness: 0.6,
      metalness: 0.1,
    });
  }, []);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} />
  );
}
