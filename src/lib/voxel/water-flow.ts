// Hydraulic water flow for the voxel world.
//
// Model: each column's "water surface" is its total height H (water sits on
// top of solids). For every column whose top block is water, transfer ONE
// water block to any neighbor whose surface is at least 2 lower. That keeps
// neighbors within 1 of each other (like a shallow-water equalizer) and lets
// water cascade down hills naturally instead of just teleporting.
//
// Capped per tick so it never freezes the main thread.

import type { VoxelWorld } from './voxel-world';

const NEIGHBORS: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function tickWaterFlow(world: VoxelWorld, maxMoves = 120): number {
  const waterId = world.idIndex.get('water');
  if (waterId === undefined) return 0;
  const W = world.width, D = world.depth, M = world.maxStackHeight;

  // Randomized scan origin so flow isn't biased to one corner.
  const offX = Math.floor(Math.random() * W);
  const offY = Math.floor(Math.random() * D);
  let moves = 0;

  for (let jj = 0; jj < D && moves < maxMoves; jj++) {
    for (let ii = 0; ii < W && moves < maxMoves; ii++) {
      const i = (ii + offX) % W;
      const j = (jj + offY) % D;
      const idx = j * W + i;
      const h = world.heights[idx];
      if (h === 0) continue;
      const top = world.cells[idx * M + h - 1];
      if (top !== waterId) continue;

      // Find the lowest neighbor below us by at least 2.
      let bestNi = -1, bestNj = -1, bestNh = h;
      for (const [di, dj] of NEIGHBORS) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || ni >= W || nj < 0 || nj >= D) continue;
        const nidx = nj * W + ni;
        const nh = world.heights[nidx];
        if (nh >= M) continue;
        if (h - nh < 2) continue;
        if (nh < bestNh) { bestNh = nh; bestNi = ni; bestNj = nj; }
      }
      if (bestNi < 0) continue;

      // Move one water block from top of (i,j) onto top of (bestNi,bestNj).
      const nidx = bestNj * W + bestNi;
      world.cells[idx * M + h - 1] = 0;
      world.heights[idx] = h - 1;
      world.cells[nidx * M + bestNh] = waterId;
      world.heights[nidx] = bestNh + 1;
      moves++;

      // Notify persistence layer that these columns changed.
      window.dispatchEvent(new CustomEvent('voxel:column-dirty', { detail: { i, j } }));
      window.dispatchEvent(new CustomEvent('voxel:column-dirty', { detail: { i: bestNi, j: bestNj } }));
    }
  }
  return moves;
}
