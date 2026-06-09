// Lightweight water spreading: water blocks at the top of a column spill onto
// adjacent columns whose top is lower (Minecraft-style infinite-source spread).
// Capped per tick so it never freezes the main thread.

import type { VoxelWorld } from './voxel-world';

const NEIGHBORS: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function tickWaterFlow(world: VoxelWorld, maxSpreads = 80): number {
  const waterId = world.idIndex.get('water');
  if (waterId === undefined) return 0;
  const W = world.width, D = world.depth, M = world.maxStackHeight;

  // Scan random starting offset so spread isn't biased to top-left.
  const offX = Math.floor(Math.random() * W);
  const offY = Math.floor(Math.random() * D);
  let spreads = 0;

  for (let jj = 0; jj < D && spreads < maxSpreads; jj++) {
    for (let ii = 0; ii < W && spreads < maxSpreads; ii++) {
      const i = (ii + offX) % W;
      const j = (jj + offY) % D;
      const idx = j * W + i;
      const h = world.heights[idx];
      if (h === 0) continue;
      const top = world.cells[idx * M + h - 1];
      if (top !== waterId) continue;

      for (const [di, dj] of NEIGHBORS) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || ni >= W || nj < 0 || nj >= D) continue;
        const nidx = nj * W + ni;
        const nh = world.heights[nidx];
        if (nh >= M) continue;
        // Spread only into columns strictly below current water surface.
        if (nh >= h) continue;
        const ntop = nh > 0 ? world.cells[nidx * M + nh - 1] : 0;
        if (ntop === waterId) continue; // already water surface
        // Lay one water block on top.
        world.cells[nidx * M + nh] = waterId;
        world.heights[nidx] = nh + 1;
        spreads++;
        if (spreads >= maxSpreads) break;
      }
    }
  }
  return spreads;
}
