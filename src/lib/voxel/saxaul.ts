// Saxaul sapling growth manager.
// Saplings advance over time into mature saxaul + leaf canopy block above.

import type { VoxelWorld } from './voxel-world';

export interface Sapling {
  i: number;
  j: number;
  plantedAt: number; // ms
  stage: 0 | 1 | 2; // 0 = sapling, 1 = young, 2 = mature
}

const GROW_INTERVAL_MS = 45_000;

export function createSaplingTracker() {
  const list: Sapling[] = [];
  return {
    plant(i: number, j: number) {
      list.push({ i, j, plantedAt: performance.now(), stage: 0 });
    },
    /** Returns true if any sapling advanced. */
    tick(world: VoxelWorld, now: number): boolean {
      let changed = false;
      const saxaulId = world.idIndex.get('saxaul')!;
      const saplingId = world.idIndex.get('sapling')!;
      const W = world.width;
      for (const s of list) {
        const target = Math.min(2, Math.floor((now - s.plantedAt) / GROW_INTERVAL_MS)) as 0 | 1 | 2;
        if (target <= s.stage) continue;
        // Update the column top to reflect new stage
        const idx = s.j * W + s.i;
        const h = world.heights[idx];
        if (h === 0) continue;
        const topCell = world.cells[idx * world.maxStackHeight + h - 1];
        if (target >= 1 && topCell === saplingId) {
          // Promote sapling to saxaul
          world.cells[idx * world.maxStackHeight + h - 1] = saxaulId;
        }
        if (target === 2 && h < world.maxStackHeight) {
          // Add a canopy block of saxaul on top (only once)
          const aboveIdx = idx * world.maxStackHeight + h;
          if (world.cells[aboveIdx] === 0) {
            world.cells[aboveIdx] = saxaulId;
            world.heights[idx] = h + 1;
          }
        }
        s.stage = target;
        changed = true;
      }
      return changed;
    },
    count(stage?: 0 | 1 | 2) {
      if (stage === undefined) return list.length;
      return list.filter(s => s.stage === stage).length;
    },
    countMature() { return list.filter(s => s.stage === 2).length; },
    list,
  };
}

export type SaplingTracker = ReturnType<typeof createSaplingTracker>;
