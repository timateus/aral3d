// Sparse per-column save/load for voxel worlds.
// Only persists columns that have been mutated from the freshly-built world,
// so storage stays small even on a 160x160 grid.

import type { VoxelWorld } from './voxel-world';

const VERSION = 1;
const KEY = (region: string) => `voxel_world_diff_v${VERSION}:${region}`;

export interface WorldDiff {
  // Map of "i,j" -> stack of palette ids (length = column height).
  cols: Record<string, number[]>;
}

export function snapshotColumn(world: VoxelWorld, i: number, j: number): number[] {
  const idx = j * world.width + i;
  const h = world.heights[idx];
  const stack: number[] = new Array(h);
  for (let k = 0; k < h; k++) stack[k] = world.cells[idx * world.maxStackHeight + k];
  return stack;
}

export function applyColumn(world: VoxelWorld, i: number, j: number, stack: number[]): void {
  if (i < 0 || i >= world.width || j < 0 || j >= world.depth) return;
  const idx = j * world.width + i;
  const M = world.maxStackHeight;
  const h = Math.min(stack.length, M);
  for (let k = 0; k < M; k++) {
    world.cells[idx * M + k] = k < h ? (stack[k] & 0xff) : 0;
  }
  world.heights[idx] = h;
}

export function loadWorldDiff(region: string): WorldDiff | null {
  try {
    const raw = localStorage.getItem(KEY(region));
    if (!raw) return null;
    return JSON.parse(raw) as WorldDiff;
  } catch { return null; }
}

export function saveWorldDiff(region: string, diff: WorldDiff): void {
  try { localStorage.setItem(KEY(region), JSON.stringify(diff)); } catch {}
}

export function clearWorldDiff(region: string): void {
  try { localStorage.removeItem(KEY(region)); } catch {}
}

export function applyDiff(world: VoxelWorld, diff: WorldDiff): void {
  for (const k of Object.keys(diff.cols)) {
    const [si, sj] = k.split(',');
    applyColumn(world, parseInt(si, 10), parseInt(sj, 10), diff.cols[k]);
  }
}
