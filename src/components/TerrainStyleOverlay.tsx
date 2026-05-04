import { useMemo } from 'react';
import * as THREE from 'three';
import { TerrainData } from '@/lib/geotiff-loader';

export type TerrainStyle = 'none' | 'contours' | 'vectors';

interface Props {
  terrain: TerrainData;
  exaggeration: number;
  style: TerrainStyle;
  contourCount?: number;
  vectorStep?: number;
}

/**
 * Compute world coordinates matching TerrainMesh:
 *   meshX = (i/(w-1) - 0.5) * 10
 *   meshY = (0.5 - j/(h-1)) * 10 * (h/w)
 *   meshZ = normalized * maxHeight
 * Then mesh is rotated [-PI/2, 0, 0]: world.x = meshX, world.y = meshZ, world.z = -meshY
 */
function meshToWorld(i: number, j: number, normalized: number, w: number, h: number, maxHeight: number) {
  const mx = (i / (w - 1) - 0.5) * 10;
  const my = (0.5 - j / (h - 1)) * 10 * (h / w);
  const mz = normalized * maxHeight;
  return [mx, mz, -my] as const;
}

const TerrainStyleOverlay = ({ terrain, exaggeration, style, contourCount = 14, vectorStep = 12 }: Props) => {
  const contourGeometry = useMemo(() => {
    if (style !== 'contours') return null;
    const { width: w, height: h, elevations, minElevation, maxElevation, noDataValue } = terrain;
    const elevRange = maxElevation - minElevation || 1;
    const maxHeight = 10 * (exaggeration / 100);
    const isND = (v: number) => isNaN(v) || (noDataValue !== null && v === noDataValue) || v <= -9999;

    const positions: number[] = [];
    const lift = 0.012; // small offset above terrain to avoid z-fighting

    // Marching-squares-lite per cell: for each iso level, find cell edges crossed.
    const levels: number[] = [];
    for (let k = 1; k < contourCount; k++) {
      levels.push(minElevation + (k / contourCount) * elevRange);
    }

    const interpolate = (i1: number, j1: number, e1: number, i2: number, j2: number, e2: number, level: number) => {
      const t = (level - e1) / (e2 - e1);
      const i = i1 + (i2 - i1) * t;
      const j = j1 + (j2 - j1) * t;
      const norm = (level - minElevation) / elevRange;
      return meshToWorld(i, j, norm, w, h, maxHeight);
    };

    for (let j = 0; j < h - 1; j++) {
      for (let i = 0; i < w - 1; i++) {
        const aE = elevations[j * w + i];
        const bE = elevations[j * w + i + 1];
        const cE = elevations[(j + 1) * w + i];
        const dE = elevations[(j + 1) * w + i + 1];
        if (isND(aE) || isND(bE) || isND(cE) || isND(dE)) continue;

        for (const level of levels) {
          const a = aE >= level;
          const b = bE >= level;
          const c = cE >= level;
          const d = dE >= level;
          const code = (a ? 1 : 0) | (b ? 2 : 0) | (d ? 4 : 0) | (c ? 8 : 0);
          if (code === 0 || code === 15) continue;

          // Edge crossings: top(a-b), right(b-d), bottom(c-d), left(a-c)
          const crossings: (readonly [number, number, number])[] = [];
          if (a !== b) crossings.push(interpolate(i, j, aE, i + 1, j, bE, level));
          if (b !== d) crossings.push(interpolate(i + 1, j, bE, i + 1, j + 1, dE, level));
          if (c !== d) crossings.push(interpolate(i, j + 1, cE, i + 1, j + 1, dE, level));
          if (a !== c) crossings.push(interpolate(i, j, aE, i, j + 1, cE, level));

          if (crossings.length === 2) {
            positions.push(crossings[0][0], crossings[0][1] + lift, crossings[0][2]);
            positions.push(crossings[1][0], crossings[1][1] + lift, crossings[1][2]);
          } else if (crossings.length === 4) {
            // Saddle: connect pairs (0-1) and (2-3)
            positions.push(crossings[0][0], crossings[0][1] + lift, crossings[0][2]);
            positions.push(crossings[1][0], crossings[1][1] + lift, crossings[1][2]);
            positions.push(crossings[2][0], crossings[2][1] + lift, crossings[2][2]);
            positions.push(crossings[3][0], crossings[3][1] + lift, crossings[3][2]);
          }
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [terrain, exaggeration, style, contourCount]);

  const vectorGeometry = useMemo(() => {
    if (style !== 'vectors') return null;
    const { width: w, height: h, elevations, minElevation, maxElevation, noDataValue } = terrain;
    const elevRange = maxElevation - minElevation || 1;
    const maxHeight = 10 * (exaggeration / 100);
    const isND = (v: number) => isNaN(v) || (noDataValue !== null && v === noDataValue) || v <= -9999;

    const positions: number[] = [];
    const lift = 0.02;
    const arrowScale = 0.18; // length of arrows in world units (max)

    // Estimate cell world-spacing for normalization
    const cellW = 10 / (w - 1);

    // Compute gradient magnitudes first to normalize
    let maxGrad = 0;
    const grads: { dx: number; dy: number; mag: number }[] = [];
    for (let j = 1; j < h - 1; j += vectorStep) {
      for (let i = 1; i < w - 1; i += vectorStep) {
        const cE = elevations[j * w + i];
        if (isND(cE)) { grads.push({ dx: 0, dy: 0, mag: 0 }); continue; }
        const eL = elevations[j * w + (i - 1)];
        const eR = elevations[j * w + (i + 1)];
        const eU = elevations[(j - 1) * w + i];
        const eD = elevations[(j + 1) * w + i];
        if (isND(eL) || isND(eR) || isND(eU) || isND(eD)) { grads.push({ dx: 0, dy: 0, mag: 0 }); continue; }
        // Gradient pointing uphill (toward higher elevation) in image space
        const dx = (eR - eL) / 2;
        const dy = (eD - eU) / 2;
        const mag = Math.hypot(dx, dy);
        if (mag > maxGrad) maxGrad = mag;
        grads.push({ dx, dy, mag });
      }
    }
    if (maxGrad === 0) maxGrad = 1;

    let idx = 0;
    for (let j = 1; j < h - 1; j += vectorStep) {
      for (let i = 1; i < w - 1; i += vectorStep) {
        const g = grads[idx++];
        if (!g || g.mag === 0) continue;
        const cE = elevations[j * w + i];
        const norm = (cE - minElevation) / elevRange;
        const [x0, y0, z0] = meshToWorld(i, j, norm, w, h, maxHeight);

        // Convert image-space gradient to world XZ plane.
        // image dx (toward +i) -> world +x. image dy (toward +j, downward in image) -> world +z (since world.z = -meshY, and meshY decreases with j).
        const len = (g.mag / maxGrad) * arrowScale;
        const ux = g.dx / g.mag;
        const uy = g.dy / g.mag; // image y
        const wx = ux;
        const wz = uy; // since dy>0 means moving in +j -> +z
        const x1 = x0 + wx * len;
        const z1 = z0 + wz * len;
        // Arrow rises slightly in proportion to gradient (uphill arrow)
        const y1 = y0 + len * 0.15;

        positions.push(x0, y0 + lift, z0);
        positions.push(x1, y1 + lift, z1);

        // Arrow head (two short tail segments)
        const headLen = len * 0.35;
        const angle = Math.atan2(wz, wx);
        const a1 = angle + Math.PI - 0.45;
        const a2 = angle + Math.PI + 0.45;
        positions.push(x1, y1 + lift, z1);
        positions.push(x1 + Math.cos(a1) * headLen, y1 + lift, z1 + Math.sin(a1) * headLen);
        positions.push(x1, y1 + lift, z1);
        positions.push(x1 + Math.cos(a2) * headLen, y1 + lift, z1 + Math.sin(a2) * headLen);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [terrain, exaggeration, style, vectorStep]);

  if (style === 'contours' && contourGeometry) {
    return (
      <lineSegments geometry={contourGeometry} renderOrder={5}>
        <lineBasicMaterial color="#1a1a1a" transparent opacity={0.55} depthTest={true} />
      </lineSegments>
    );
  }

  if (style === 'vectors' && vectorGeometry) {
    return (
      <lineSegments geometry={vectorGeometry} renderOrder={5}>
        <lineBasicMaterial color="#0a0a0a" transparent opacity={0.7} depthTest={true} />
      </lineSegments>
    );
  }

  return null;
};

export default TerrainStyleOverlay;
