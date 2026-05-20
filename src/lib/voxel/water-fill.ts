// Lightweight flood-fill canal water.
// After a column is dug below or near the regional water level, scan a window
// around it: any column whose top is below `waterLevelBlocks` and connected
// (4-neighbor) to an existing water column receives water on top.

import type { VoxelWorld } from './voxel-world';

export function floodFillCanal(
  world: VoxelWorld,
  seedI: number,
  seedJ: number,
  waterLevelBlocks: number,
  capN = 400,
): number {
  const W = world.width, D = world.depth;
  if (seedI < 0 || seedI >= W || seedJ < 0 || seedJ >= D) return 0;

  const waterId = world.idIndex.get('water')!;
  const isWaterTop = (i: number, j: number) => {
    const h = world.heights[j * W + i];
    if (h === 0) return false;
    const top = world.cells[(j * W + i) * world.maxStackHeight + h - 1];
    return top === waterId;
  };

  // BFS from candidate columns within a radius of the dig site.
  const R = 20;
  const i0 = Math.max(0, seedI - R), i1 = Math.min(W - 1, seedI + R);
  const j0 = Math.max(0, seedJ - R), j1 = Math.min(D - 1, seedJ + R);

  // Seed queue with any existing water column in the window.
  const queue: number[] = [];
  const visited = new Uint8Array(W * D);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      if (isWaterTop(i, j)) {
        const k = j * W + i;
        queue.push(k);
        visited[k] = 1;
      }
    }
  }
  if (queue.length === 0) return 0;

  let filled = 0;
  while (queue.length > 0 && filled < capN) {
    const k = queue.shift()!;
    const ci = k % W, cj = Math.floor(k / W);
    const ns = [[ci+1,cj],[ci-1,cj],[ci,cj+1],[ci,cj-1]];
    for (const [ni, nj] of ns) {
      if (ni < 0 || ni >= W || nj < 0 || nj >= D) continue;
      const nk = nj * W + ni;
      if (visited[nk]) continue;
      visited[nk] = 1;
      const h = world.heights[nk];
      if (h === 0) continue;
      // Eligible to receive water: top is below water level and not already water/solid above
      const topIdx = world.cells[nk * world.maxStackHeight + h - 1];
      const isWater = topIdx === waterId;
      if (isWater) { queue.push(nk); continue; }
      if (h - 1 < waterLevelBlocks && h < world.maxStackHeight) {
        // Stack water blocks up to waterLevelBlocks
        let placed = 0;
        while (world.heights[nk] < waterLevelBlocks && world.heights[nk] < world.maxStackHeight) {
          const ph = world.heights[nk];
          world.cells[nk * world.maxStackHeight + ph] = waterId;
          world.heights[nk] = ph + 1;
          placed++;
          if (placed > 3) break;
        }
        if (placed > 0) {
          filled++;
          queue.push(nk);
        }
      }
    }
  }
  return filled;
}
