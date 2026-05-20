// Multi-block placeable structures.

import type { VoxelWorld } from './voxel-world';
import type { BlockId } from './block-types';

export interface StructureBlock { dx: number; dy: number; dz: number; block: BlockId; }
export interface Structure {
  id: string;
  name: string;
  description: string;
  cost: { block: BlockId; count: number }[];
  blocks: StructureBlock[];
}

// Build a small yurt: floor, walls, roof apex.
function yurtBlocks(): StructureBlock[] {
  const out: StructureBlock[] = [];
  // 3x3 floor of mud at dy=0
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    if (dx === 0 && dz === 0) continue;
    out.push({ dx, dy: 0, dz, block: 'reed' });
  }
  // Walls dy=1
  for (let dx = -1; dx <= 1; dx++) {
    out.push({ dx, dy: 1, dz: -1, block: 'reed' });
    out.push({ dx, dy: 1, dz: 1, block: 'reed' });
  }
  out.push({ dx: -1, dy: 1, dz: 0, block: 'reed' });
  out.push({ dx: 1, dy: 1, dz: 0, block: 'reed' });
  // Roof apex saxaul
  out.push({ dx: 0, dy: 2, dz: 0, block: 'saxaul' });
  return out;
}

export const STRUCTURES: Structure[] = [
  {
    id: 'yurt',
    name: 'Yurt (spawn)',
    description: 'Home base. Reed walls, saxaul peak.',
    cost: [{ block: 'reed', count: 6 }, { block: 'saxaul', count: 2 }],
    blocks: yurtBlocks(),
  },
  {
    id: 'well',
    name: 'Well',
    description: 'Stone-lined well. Right-click with bucket for water anywhere.',
    cost: [{ block: 'clay', count: 4 }, { block: 'stone', count: 2 }],
    blocks: [
      { dx: 0, dy: 0, dz: 0, block: 'water' },
      { dx: 1, dy: 0, dz: 0, block: 'stone' },
      { dx: -1, dy: 0, dz: 0, block: 'stone' },
      { dx: 0, dy: 0, dz: 1, block: 'stone' },
      { dx: 0, dy: 0, dz: -1, block: 'stone' },
    ],
  },
  {
    id: 'kiln',
    name: 'Brick Kiln',
    description: 'Marks a baking station. Bake clay → brick at crafting bench.',
    cost: [{ block: 'clay', count: 6 }, { block: 'saxaul', count: 2 }],
    blocks: [
      { dx: 0, dy: 0, dz: 0, block: 'brick' },
      { dx: 1, dy: 0, dz: 0, block: 'brick' },
      { dx: 0, dy: 0, dz: 1, block: 'brick' },
      { dx: 1, dy: 0, dz: 1, block: 'brick' },
      { dx: 0, dy: 1, dz: 0, block: 'brick' },
      { dx: 1, dy: 1, dz: 0, block: 'brick' },
    ],
  },
  {
    id: 'gate',
    name: 'Canal Gate',
    description: 'Single brick block marker for canal control.',
    cost: [{ block: 'brick', count: 4 }],
    blocks: [{ dx: 0, dy: 0, dz: 0, block: 'brick' }],
  },
];

export function placeStructure(world: VoxelWorld, anchorI: number, anchorJ: number, struct: Structure): boolean {
  // Anchor y = top of anchor column
  const W = world.width, D = world.depth;
  for (const b of struct.blocks) {
    const ii = anchorI + b.dx, jj = anchorJ + b.dz;
    if (ii < 0 || ii >= W || jj < 0 || jj >= D) return false;
  }
  // Stamp blocks on top of each column's current height.
  for (const b of struct.blocks) {
    const ii = anchorI + b.dx, jj = anchorJ + b.dz;
    const idx = jj * W + ii;
    const baseH = world.heights[idx];
    const y = baseH + b.dy;
    if (y >= world.maxStackHeight) continue;
    world.cells[idx * world.maxStackHeight + y] = world.idIndex.get(b.block) ?? 0;
    if (y + 1 > world.heights[idx]) world.heights[idx] = y + 1;
  }
  return true;
}
