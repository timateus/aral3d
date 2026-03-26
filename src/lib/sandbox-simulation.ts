/**
 * Aralspiel – terrain-resolution sandbox simulation.
 * Elements: river water, irrigation water, salt, dust/wind, reeds/life.
 * All arrays are Float32Array at terrain resolution for performance.
 */
import type { TerrainData } from '@/lib/geotiff-loader';

export type SandboxElement = 'river' | 'irrigation' | 'salt' | 'dust' | 'reeds' | 'eraser';

export const SANDBOX_ELEMENTS: { type: SandboxElement; label: string; color: string; desc: string }[] = [
  { type: 'river',      label: 'River Water',  color: '#1e90ff', desc: 'Flows downhill, fills basins' },
  { type: 'irrigation', label: 'Irrigation',   color: '#d4a017', desc: 'Extracted flow — evaporates, leaves salt' },
  { type: 'salt',       label: 'Salt',         color: '#e8e0d0', desc: 'Crystallises on dry seabed' },
  { type: 'dust',       label: 'Dust / Wind',  color: '#c9a87c', desc: 'Airborne salt & toxins, drifts' },
  { type: 'reeds',      label: 'Reeds / Life', color: '#4a9a3a', desc: 'Grows near water, dies in salt' },
  { type: 'eraser',     label: 'Erase',        color: '#888888', desc: 'Remove all elements' },
];

export interface SandboxSimState {
  waterDepth: Float32Array;      // river water
  irrigationDepth: Float32Array; // irrigation / cotton water
  saltDepth: Float32Array;       // crystallised salt
  dustDensity: Float32Array;     // airborne dust/toxins
  reedsDensity: Float32Array;    // reeds, life
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
    irrigationDepth: new Float32Array(n),
    saltDepth: new Float32Array(n),
    dustDensity: new Float32Array(n),
    reedsDensity: new Float32Array(n),
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
        case 'river':
          state.waterDepth[idx] += amt;
          break;
        case 'irrigation':
          state.irrigationDepth[idx] += amt * 1.2;
          break;
        case 'salt':
          state.saltDepth[idx] += amt * 1.5;
          state.effectiveElev[idx] = state.baseElev[idx] + state.saltDepth[idx];
          break;
        case 'dust':
          state.dustDensity[idx] = Math.max(state.dustDensity[idx], 100 * falloff);
          break;
        case 'reeds':
          state.reedsDensity[idx] = Math.min(state.reedsDensity[idx] + amt * 2, 20);
          break;
        case 'eraser':
          state.waterDepth[idx] = 0;
          state.irrigationDepth[idx] = 0;
          state.saltDepth[idx] = 0;
          state.dustDensity[idx] = 0;
          state.reedsDensity[idx] = 0;
          state.effectiveElev[idx] = state.baseElev[idx];
          break;
      }
    }
  }
}

export function stepSandboxSim(state: SandboxSimState): void {
  const { width, height, waterDepth, irrigationDepth, saltDepth, dustDensity, reedsDensity, effectiveElev, baseElev } = state;
  state.generation++;
  const n = width * height;
  const waterDelta = new Float32Array(n);
  const irrigDelta = new Float32Array(n);
  const saltDelta = new Float32Array(n);
  const dustDelta = new Float32Array(n);
  const neighbors = [-width, width, -1, 1];

  // Wind direction (predominantly east with slight south)
  const windEast = 1;   // +col
  const windSouth = width; // +row (slight southward component)
  const windStrength = 0.02; // base wind push on water surface

  // === River water flow (downhill, fast + wind bias) ===
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
      let diff = surfaceLevel - nSurface;
      // Wind bias pushes water east and slightly south
      if (d === windEast) diff += windStrength * waterDepth[i];
      if (d === windSouth) diff += windStrength * 0.3 * waterDepth[i];
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

  // === Irrigation water (flows like water but evaporates, leaves salt behind) ===
  for (let i = 0; i < n; i++) {
    if (irrigationDepth[i] < 0.01) continue;
    const surfaceLevel = effectiveElev[i] + irrigationDepth[i];
    let totalDiff = 0;
    const diffs: number[] = [];
    const nIdxs: number[] = [];
    for (const d of neighbors) {
      const ni = i + d;
      if (ni < 0 || ni >= n) continue;
      if (d === -1 && (i % width) === 0) continue;
      if (d === 1 && (i % width) === width - 1) continue;
      const nSurface = effectiveElev[ni] + irrigationDepth[ni];
      const diff = surfaceLevel - nSurface;
      if (diff > 0) { diffs.push(diff); nIdxs.push(ni); totalDiff += diff; }
    }
    // Wind bias on irrigation too
    const eastNi = i + 1;
    if ((i % width) < width - 1 && eastNi < n) {
      const diff = surfaceLevel - (effectiveElev[eastNi] + irrigationDepth[eastNi]) + windStrength * 0.5 * irrigationDepth[i];
      if (diff > 0) { diffs.push(diff); nIdxs.push(eastNi); totalDiff += diff; }
    }
    if (totalDiff > 0) {
      const flow = Math.min(irrigationDepth[i] * 0.15, irrigationDepth[i]); // slower than river
      for (let j = 0; j < nIdxs.length; j++) {
        const share = (diffs[j] / totalDiff) * flow;
        irrigDelta[i] -= share;
        irrigDelta[nIdxs[j]] += share;
      }
    }
    // Evaporation — irrigation water slowly vanishes, depositing salt
    const evap = irrigationDepth[i] * 0.003;
    irrigDelta[i] -= evap;
    saltDepth[i] += evap * 0.4; // residual salt
    effectiveElev[i] = baseElev[i] + saltDepth[i];
  }
  for (let i = 0; i < n; i++) irrigationDepth[i] = Math.max(0, irrigationDepth[i] + irrigDelta[i]);

  // === Salt accumulation & slow spread (like sand avalanche) ===
  for (let i = 0; i < n; i++) {
    if (saltDepth[i] < 0.05) continue;
    const myElev = effectiveElev[i];
    for (const d of neighbors) {
      const ni = i + d;
      if (ni < 0 || ni >= n) continue;
      if (d === -1 && (i % width) === 0) continue;
      if (d === 1 && (i % width) === width - 1) continue;
      const diff = myElev - effectiveElev[ni];
      if (diff > 3.0) {
        const flow = Math.min(saltDepth[i] * 0.05, diff * 0.02);
        saltDelta[i] -= flow;
        saltDelta[ni] += flow;
      }
    }
    // Salt dissolves in river water
    if (waterDepth[i] > 0.5) {
      const dissolve = Math.min(saltDepth[i], waterDepth[i] * 0.01);
      saltDepth[i] -= dissolve;
    }
  }
  for (let i = 0; i < n; i++) {
    saltDepth[i] = Math.max(0, saltDepth[i] + saltDelta[i]);
    effectiveElev[i] = baseElev[i] + saltDepth[i];
  }

  // === Dust / Wind — drifts across terrain, deposits salt ===
  // Wind blows predominantly eastward (+col direction) with some spread
  const windBias = 1; // +1 col = east
  for (let i = 0; i < n; i++) {
    if (dustDensity[i] < 0.1) continue;
    // Dust picks up salt from exposed seabed
    if (saltDepth[i] > 0.1 && waterDepth[i] < 0.05 && irrigationDepth[i] < 0.05) {
      const pickup = Math.min(saltDepth[i] * 0.01, 0.05);
      saltDepth[i] -= pickup;
      dustDensity[i] += pickup * 5;
    }
    // Drift: move dust to neighbors with wind bias
    const drift = dustDensity[i] * 0.08;
    // Primary wind direction (east)
    const eastIdx = i + windBias;
    if (eastIdx >= 0 && eastIdx < n && (i % width) < width - 1) {
      dustDelta[eastIdx] += drift * 0.5;
      dustDelta[i] -= drift * 0.5;
    }
    // Secondary spread (north/south)
    for (const d of [-width, width]) {
      const ni = i + d;
      if (ni >= 0 && ni < n) {
        dustDelta[ni] += drift * 0.15;
        dustDelta[i] -= drift * 0.15;
      }
    }
    // Dust settles as salt deposit
    const settle = dustDensity[i] * 0.005;
    dustDensity[i] -= settle;
    saltDepth[i] += settle * 0.3;
    // Dust suppressed by water
    if (waterDepth[i] > 0.2) {
      dustDensity[i] *= 0.9;
    }
    // Dust kills reeds
    if (dustDensity[i] > 20 && reedsDensity[i] > 0) {
      reedsDensity[i] -= 0.1;
      if (reedsDensity[i] < 0) reedsDensity[i] = 0;
    }
    // Natural decay
    dustDensity[i] -= 0.15;
    if (dustDensity[i] < 0) dustDensity[i] = 0;
  }
  for (let i = 0; i < n; i++) dustDensity[i] = Math.max(0, dustDensity[i] + dustDelta[i]);

  // === Reeds / Life — grow near water, die in salt & dust ===
  if (state.generation % 3 === 0) {
    for (let i = 0; i < n; i++) {
      if (reedsDensity[i] <= 0) continue;
      // Salt kills reeds
      if (saltDepth[i] > 1.0) {
        reedsDensity[i] -= 0.2;
        if (reedsDensity[i] < 0) reedsDensity[i] = 0;
        continue;
      }
      // Grow near water
      let hasWater = false;
      for (const d of neighbors) {
        const ni = i + d;
        if (ni >= 0 && ni < n && (waterDepth[ni] > 0.05 || irrigationDepth[ni] > 0.05)) {
          hasWater = true; break;
        }
      }
      if (hasWater) reedsDensity[i] = Math.min(reedsDensity[i] + 0.3, 20);
      // Spread
      if (reedsDensity[i] > 2 && state.generation % 6 === 0) {
        for (const d of neighbors) {
          const ni = i + d;
          if (ni < 0 || ni >= n) continue;
          if (d === -1 && (i % width) === 0) continue;
          if (d === 1 && (i % width) === width - 1) continue;
          if (reedsDensity[ni] < 0.1 && saltDepth[ni] < 0.5 && dustDensity[ni] < 10) {
            reedsDensity[ni] = 1.0;
          }
        }
      }
    }
  }

  // === River water dissolves irrigation remnants when they meet ===
  for (let i = 0; i < n; i++) {
    if (waterDepth[i] > 0.1 && irrigationDepth[i] > 0.1) {
      // They merge into river water
      const merge = Math.min(irrigationDepth[i], waterDepth[i] * 0.1);
      irrigationDepth[i] -= merge;
      waterDepth[i] += merge * 0.5; // some lost to evap
    }
  }
}

export function countActivePixels(state: SandboxSimState): number {
  let count = 0;
  const n = state.width * state.height;
  for (let i = 0; i < n; i++) {
    if (state.waterDepth[i] > 0.01 || state.irrigationDepth[i] > 0.01 ||
        state.saltDepth[i] > 0.01 || state.dustDensity[i] > 0.1 ||
        state.reedsDensity[i] > 0.01) count++;
  }
  return count;
}
