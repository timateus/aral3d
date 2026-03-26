/**
 * Terrain-resolution sandbox simulation.
 * All arrays are Float32Array at terrain resolution for performance.
 */
import type { TerrainData } from '@/lib/geotiff-loader';

export type SandboxElement = 'water' | 'sand' | 'fire' | 'plant' | 'lava' | 'eraser';

export const SANDBOX_ELEMENTS: { type: SandboxElement; label: string; color: string }[] = [
  { type: 'water', label: 'Water', color: '#1e90ff' },
  { type: 'sand', label: 'Sand', color: '#d2b48c' },
  { type: 'fire', label: 'Fire', color: '#ff4500' },
  { type: 'plant', label: 'Plant', color: '#22c55e' },
  { type: 'lava', label: 'Lava', color: '#ff6600' },
  { type: 'eraser', label: 'Erase', color: '#888888' },
];

export interface SandboxSimState {
  waterDepth: Float32Array;
  sandDepth: Float32Array;
  fireIntensity: Float32Array;
  plantDensity: Float32Array;
  lavaDepth: Float32Array;
  effectiveElev: Float32Array;
  baseElev: Float32Array;
  width: number;
  height: number;
  generation: number;
}

export function createSandboxSim(terrain: TerrainData): SandboxSimState {
  const n = terrain.width * terrain.height;
  const baseElev = new Float32Array(n);
  const effectiveElev = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let e = terrain.elevations[i];
    if (isNaN(e) || e <= -9999) e = terrain.minElevation;
    baseElev[i] = e;
    effectiveElev[i] = e;
  }
  return {
    waterDepth: new Float32Array(n),
    sandDepth: new Float32Array(n),
    fireIntensity: new Float32Array(n),
    plantDensity: new Float32Array(n),
    lavaDepth: new Float32Array(n),
    effectiveElev,
    baseElev,
    width: terrain.width,
    height: terrain.height,
    generation: 0,
  };
}

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
      const amt = amount * falloff;

      switch (element) {
        case 'water':
          state.waterDepth[idx] += amt;
          break;
        case 'sand':
          state.sandDepth[idx] += amt * 1.5; // Sand stacks up more
          state.effectiveElev[idx] = state.baseElev[idx] + state.sandDepth[idx];
          break;
        case 'fire':
          state.fireIntensity[idx] = Math.max(state.fireIntensity[idx], 120 * falloff); // Longer-lasting fire
          break;
        case 'plant':
          state.plantDensity[idx] = Math.min(state.plantDensity[idx] + amt * 2, 20); // Higher cap
          break;
        case 'lava':
          state.lavaDepth[idx] += amt * 1.2;
          break;
        case 'eraser':
          state.waterDepth[idx] = 0;
          state.sandDepth[idx] = 0;
          state.fireIntensity[idx] = 0;
          state.plantDensity[idx] = 0;
          state.lavaDepth[idx] = 0;
          state.effectiveElev[idx] = state.baseElev[idx];
          break;
      }
    }
  }
}

export function stepSandboxSim(state: SandboxSimState): void {
  const { width, height, waterDepth, sandDepth, fireIntensity, plantDensity, lavaDepth, effectiveElev, baseElev } = state;
  state.generation++;
  const n = width * height;
  const waterDelta = new Float32Array(n);
  const lavaDelta = new Float32Array(n);
  const sandDelta = new Float32Array(n);
  const neighbors = [-width, width, -1, 1];

  // Water flow
  for (let i = 0; i < n; i++) {
    if (waterDepth[i] < 0.01) continue;
    const surfaceLevel = effectiveElev[i] + waterDepth[i];
    let totalDiff = 0;
    const diffs: number[] = [];
    const nIdxs: number[] = [];
    for (const d of neighbors) {
      const ni = i + d;
      if (ni < 0 || ni >= n) continue;
      if (d === -1 && (i % width) === 0) continue;
      if (d === 1 && (i % width) === width - 1) continue;
      const nSurface = effectiveElev[ni] + waterDepth[ni];
      const diff = surfaceLevel - nSurface;
      if (diff > 0) { diffs.push(diff); nIdxs.push(ni); totalDiff += diff; }
    }
    if (totalDiff > 0) {
      const flow = Math.min(waterDepth[i] * 0.25, waterDepth[i]);
      for (let j = 0; j < nIdxs.length; j++) {
        const share = (diffs[j] / totalDiff) * flow;
        waterDelta[i] -= share;
        waterDelta[nIdxs[j]] += share;
      }
    }
  }
  for (let i = 0; i < n; i++) waterDepth[i] = Math.max(0, waterDepth[i] + waterDelta[i]);

  // Sand flow
  for (let i = 0; i < n; i++) {
    if (sandDepth[i] < 0.05) continue;
    const myElev = effectiveElev[i];
    for (const d of neighbors) {
      const ni = i + d;
      if (ni < 0 || ni >= n) continue;
      if (d === -1 && (i % width) === 0) continue;
      if (d === 1 && (i % width) === width - 1) continue;
      const diff = myElev - effectiveElev[ni];
      if (diff > 3.0) { // Higher threshold = more stacking before avalanche
        const flow = Math.min(sandDepth[i] * 0.05, diff * 0.02); // Slower flow = taller piles
        sandDelta[i] -= flow;
        sandDelta[ni] += flow;
      }
    }
  }
  for (let i = 0; i < n; i++) {
    sandDepth[i] = Math.max(0, sandDepth[i] + sandDelta[i]);
    effectiveElev[i] = baseElev[i] + sandDepth[i];
  }

  // Lava flow
  for (let i = 0; i < n; i++) {
    if (lavaDepth[i] < 0.01) continue;
    const surfaceLevel = effectiveElev[i] + lavaDepth[i];
    let totalDiff = 0;
    const diffs: number[] = [];
    const nIdxs: number[] = [];
    for (const d of neighbors) {
      const ni = i + d;
      if (ni < 0 || ni >= n) continue;
      if (d === -1 && (i % width) === 0) continue;
      if (d === 1 && (i % width) === width - 1) continue;
      const nSurface = effectiveElev[ni] + lavaDepth[ni];
      const diff = surfaceLevel - nSurface;
      if (diff > 0) { diffs.push(diff); nIdxs.push(ni); totalDiff += diff; }
    }
    if (totalDiff > 0) {
      const flow = Math.min(lavaDepth[i] * 0.08, lavaDepth[i]);
      for (let j = 0; j < nIdxs.length; j++) {
        const share = (diffs[j] / totalDiff) * flow;
        lavaDelta[i] -= share;
        lavaDelta[nIdxs[j]] += share;
      }
    }
    const solidify = lavaDepth[i] * 0.0005; // Much slower solidification
    lavaDepth[i] -= solidify;
    baseElev[i] += solidify;
    effectiveElev[i] = baseElev[i] + sandDepth[i];
  }
  for (let i = 0; i < n; i++) lavaDepth[i] = Math.max(0, lavaDepth[i] + lavaDelta[i]);

  // Lava-water interaction
  for (let i = 0; i < n; i++) {
    if (lavaDepth[i] > 0.1 && waterDepth[i] > 0.1) {
      const evap = Math.min(waterDepth[i], lavaDepth[i] * 0.5);
      waterDepth[i] -= evap;
      const cool = Math.min(lavaDepth[i], evap * 0.3);
      lavaDepth[i] -= cool;
      baseElev[i] += cool;
      effectiveElev[i] = baseElev[i] + sandDepth[i];
    }
  }

  // Fire
  for (let i = 0; i < n; i++) {
    if (fireIntensity[i] <= 0) continue;
    fireIntensity[i] -= 0.3; // Much slower decay — fire burns longer
    if (fireIntensity[i] <= 0) { fireIntensity[i] = 0; continue; }
    if (plantDensity[i] > 0) {
      const burn = Math.min(plantDensity[i], 0.15); // Slower burn = longer interaction
      plantDensity[i] -= burn;
      fireIntensity[i] = Math.min(fireIntensity[i] + 8, 150); // Higher cap
    }
    if (waterDepth[i] > 0) {
      const evap = Math.min(waterDepth[i], 0.1); // Slower evaporation
      waterDepth[i] -= evap;
      fireIntensity[i] -= 1;
      if (fireIntensity[i] <= 0) { fireIntensity[i] = 0; continue; }
    }
    // Fire spreads more aggressively
    if (state.generation % 2 === 0) {
      for (const d of neighbors) {
        const ni = i + d;
        if (ni < 0 || ni >= n) continue;
        if (d === -1 && (i % width) === 0) continue;
        if (d === 1 && (i % width) === width - 1) continue;
        if (plantDensity[ni] > 0.3 && fireIntensity[ni] <= 0) fireIntensity[ni] = 30;
      }
    }
  }

  // Plant growth — faster and more lush
  if (state.generation % 3 === 0) {
    for (let i = 0; i < n; i++) {
      if (plantDensity[i] <= 0 || fireIntensity[i] > 0) continue;
      let hasWater = false;
      for (const d of neighbors) {
        const ni = i + d;
        if (ni >= 0 && ni < n && waterDepth[ni] > 0.05) { hasWater = true; break; }
      }
      if (hasWater) plantDensity[i] = Math.min(plantDensity[i] + 0.3, 20);
      // Spread more aggressively
      if (plantDensity[i] > 2 && state.generation % 6 === 0) {
        for (const d of neighbors) {
          const ni = i + d;
          if (ni < 0 || ni >= n) continue;
          if (d === -1 && (i % width) === 0) continue;
          if (d === 1 && (i % width) === width - 1) continue;
          if (plantDensity[ni] < 0.1 && fireIntensity[ni] <= 0) plantDensity[ni] = 1.0;
        }
      }
    }
  }
}

export function countActivePixels(state: SandboxSimState): number {
  let count = 0;
  const n = state.width * state.height;
  for (let i = 0; i < n; i++) {
    if (state.waterDepth[i] > 0.01 || state.sandDepth[i] > 0.01 ||
        state.fireIntensity[i] > 0 || state.plantDensity[i] > 0.01 ||
        state.lavaDepth[i] > 0.01) count++;
  }
  return count;
}
