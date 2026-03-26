/**
 * Sandbox simulation — water only.
 * Reuses the same downhill pipe-model flow physics as the water flow tool.
 */
import type { TerrainData } from '@/lib/geotiff-loader';

export type SandboxElement = 'water' | 'eraser';

export interface SandboxSimState {
  waterDepth: Float32Array;
  width: number;
  height: number;
  terrain: TerrainData;
  stepCount: number;
}

export function createSandboxSim(terrain: TerrainData): SandboxSimState {
  return {
    waterDepth: new Float32Array(terrain.width * terrain.height),
    width: terrain.width,
    height: terrain.height,
    terrain,
    stepCount: 0,
  };
}

/**
 * Place a block of water at (row, col) with given amount and radius.
 */
export function addElementAt(
  state: SandboxSimState,
  row: number, col: number,
  element: SandboxElement,
  amount: number = 5,
  radius: number = 6,
): void {
  const { width, height } = state;
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= height || c < 0 || c >= width) continue;
      const dist = Math.sqrt(dr * dr + dc * dc);
      if (dist > radius) continue;
      const falloff = 1 - dist / (radius + 1);
      const idx = r * width + c;
      if (element === 'water') {
        state.waterDepth[idx] += amount * falloff;
      } else {
        state.waterDepth[idx] = 0;
      }
    }
  }
}

/**
 * One simulation step — identical physics to water-flow-simulation.ts pipe model.
 */
export function stepSandboxSim(state: SandboxSimState): void {
  const { waterDepth, width, height, terrain } = state;
  const { elevations, noDataValue } = terrain;
  const n = width * height;
  const outflow = new Float32Array(n);
  const inflow = new Float32Array(n);
  const flowRate = 0.25;

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const idx = r * width + c;
      const water = waterDepth[idx];
      if (water < 0.001) continue;

      let elev = elevations[idx];
      if (isNaN(elev) || (noDataValue !== null && elev === noDataValue) || elev <= -9999) continue;

      const surfaceLevel = elev + water;
      let totalDiff = 0;
      const diffs: number[] = [];
      const nIdxs: number[] = [];

      const dirs = [
        r > 0 ? (r - 1) * width + c : -1,
        r < height - 1 ? (r + 1) * width + c : -1,
        c > 0 ? r * width + (c - 1) : -1,
        c < width - 1 ? r * width + (c + 1) : -1,
      ];

      for (const ni of dirs) {
        if (ni < 0) continue;
        const nElev = elevations[ni];
        if (isNaN(nElev) || (noDataValue !== null && nElev === noDataValue) || nElev <= -9999) continue;
        const nSurface = nElev + waterDepth[ni];
        const diff = surfaceLevel - nSurface;
        if (diff > 0.001) {
          diffs.push(diff);
          nIdxs.push(ni);
          totalDiff += diff;
        }
      }

      if (totalDiff <= 0) continue;
      const maxOut = water * flowRate;
      for (let i = 0; i < nIdxs.length; i++) {
        const share = (diffs[i] / totalDiff) * maxOut;
        outflow[idx] += share;
        inflow[nIdxs[i]] += share;
      }
    }
  }

  for (let i = 0; i < n; i++) {
    waterDepth[i] = Math.max(0, waterDepth[i] - outflow[i] + inflow[i]);
  }
  state.stepCount++;
}

export function countActivePixels(state: SandboxSimState): number {
  let count = 0;
  for (let i = 0; i < state.waterDepth.length; i++) {
    if (state.waterDepth[i] > 0.01) count++;
  }
  return count;
}
