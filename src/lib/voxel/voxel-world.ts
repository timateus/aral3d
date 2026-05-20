// Build a voxel world from a real DEM.
// Strict for terrain shape (downsampled real elevation); freeform for resources.

import type { TerrainData } from '@/lib/geotiff-loader';
import type { BlockId } from './block-types';

export interface VoxelWorld {
  width: number;      // columns in X
  depth: number;      // columns in Z
  blockSize: number;  // world units per block (=1)
  maxStackHeight: number;
  // For each column, the stack of block ids bottom→top (length = height).
  // Stored as a flat Uint8Array of size width*depth*maxStackHeight.
  // Empty cells contain 0 (air).
  cells: Uint8Array;
  // Current height of each column (number of solid blocks, top index = height-1).
  heights: Uint16Array;
  // Lookup table aligned with cells values.
  palette: BlockId[];
  // Inverse of palette.
  idIndex: Map<BlockId, number>;
}

const PALETTE: BlockId[] = [
  'air','water','sand','salt','dirt','stone','grass','reed','saxaul','clay','mud','snow','soap','sapling',
];

function buildIdIndex(): Map<BlockId, number> {
  const m = new Map<BlockId, number>();
  PALETTE.forEach((b, i) => m.set(b, i));
  return m;
}

export interface VoxelWorldOptions {
  targetWidth?: number;
  targetDepth?: number;
  blockHeightMeters?: number;
  verticalExaggeration?: number;
  waterLevelMeters?: number;
  resourceSeed?: number;
}

export function buildVoxelWorld(terrain: TerrainData, opts: VoxelWorldOptions = {}): VoxelWorld {
  const targetW = opts.targetWidth ?? 180;
  const targetD = opts.targetDepth ?? 180;
  const blockMeters = opts.blockHeightMeters ?? 4;
  const vexag = opts.verticalExaggeration ?? 2.5;
  const waterLevel = opts.waterLevelMeters ?? 53;
  const seed = opts.resourceSeed ?? 1337;

  const srcW = terrain.width;
  const srcH = terrain.height;
  const scaleX = srcW / targetW;
  const scaleY = srcH / targetD;

  const heights = new Uint16Array(targetW * targetD);
  const surfaceElev = new Float32Array(targetW * targetD);

  let minElev = Infinity;
  let maxElev = -Infinity;

  // First pass: average elevation per target cell, find extremes.
  const avgs = new Float32Array(targetW * targetD);
  const valid = new Uint8Array(targetW * targetD);
  for (let j = 0; j < targetD; j++) {
    for (let i = 0; i < targetW; i++) {
      const x0 = Math.floor(i * scaleX);
      const x1 = Math.max(x0 + 1, Math.floor((i + 1) * scaleX));
      const y0 = Math.floor(j * scaleY);
      const y1 = Math.max(y0 + 1, Math.floor((j + 1) * scaleY));
      let sum = 0, count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const e = terrain.elevations[y * srcW + x];
          if (isNaN(e) || e <= -9999) continue;
          if (terrain.noDataValue !== null && e === terrain.noDataValue) continue;
          sum += e; count++;
        }
      }
      const idx = j * targetW + i;
      if (count > 0) {
        const a = sum / count;
        avgs[idx] = a;
        valid[idx] = 1;
        if (a < minElev) minElev = a;
        if (a > maxElev) maxElev = a;
      }
    }
  }

  if (!isFinite(minElev)) { minElev = terrain.minElevation; maxElev = terrain.maxElevation; }

  // Max stack height — exaggerated elevation range mapped into blocks.
  const range = Math.max(1, (maxElev - minElev) * vexag);
  const maxStackHeight = Math.min(64, Math.ceil(range / blockMeters) + 8);
  const cells = new Uint8Array(targetW * targetD * maxStackHeight);
  const idIndex = buildIdIndex();
  const ID = (b: BlockId) => idIndex.get(b)!;

  // Cheap deterministic noise.
  let s = seed >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s & 0xfffffff) / 0xfffffff; };

  // Second pass: build column block stacks.
  for (let j = 0; j < targetD; j++) {
    for (let i = 0; i < targetW; i++) {
      const idx = j * targetW + i;
      if (!valid[idx]) { heights[idx] = 0; continue; }
      const elev = avgs[idx];
      surfaceElev[idx] = elev;
      const h = Math.max(1, Math.min(maxStackHeight, Math.round(((elev - minElev) * vexag) / blockMeters) + 1));
      heights[idx] = h;

      const base = idx * maxStackHeight;
      const isUnderwater = elev < waterLevel;

      // Determine top biome.
      const r = rand();
      let topBlock: BlockId;
      if (isUnderwater) {
        topBlock = 'water';
      } else if (elev < waterLevel + 2) {
        topBlock = r < 0.6 ? 'mud' : 'clay';
      } else if (elev < waterLevel + 12) {
        topBlock = r < 0.15 ? 'reed' : r < 0.7 ? 'grass' : 'dirt';
      } else if (elev > maxElev - 6) {
        topBlock = r < 0.3 ? 'snow' : 'stone';
      } else if (elev > maxElev - 20) {
        topBlock = r < 0.7 ? 'stone' : 'dirt';
      } else {
        // Plains / dry seabed
        topBlock = r < 0.25 ? 'salt' : r < 0.85 ? 'sand' : 'dirt';
      }

      // Sprinkle saxaul on sand
      if (topBlock === 'sand' && rand() < 0.04) topBlock = 'saxaul';
      // Extra salt patches on the deepest dry plains
      if (topBlock === 'sand' && elev < waterLevel + 8 && rand() < 0.3) topBlock = 'salt';

      // Stack: bottom = stone, middle = dirt, top = topBlock (water sits as top layers).
      for (let y = 0; y < h; y++) {
        let b: BlockId;
        if (isUnderwater) {
          // Underwater columns: stone floor, mud, then water above terrain floor.
          // Approximate water depth in blocks.
          const waterDepthBlocks = Math.max(0, Math.round(((waterLevel - elev) * vexag) / blockMeters));
          const floorTop = Math.max(0, h - 1 - waterDepthBlocks);
          if (y < floorTop - 1) b = 'stone';
          else if (y === floorTop - 1) b = 'mud';
          else if (y === floorTop) b = 'sand';
          else b = 'water';
        } else {
          if (y === h - 1) b = topBlock;
          else if (y >= h - 3) b = 'dirt';
          else b = 'stone';
        }
        cells[base + y] = ID(b);
      }
    }
  }

  return {
    width: targetW,
    depth: targetD,
    blockSize: 1,
    maxStackHeight,
    cells,
    heights,
    palette: PALETTE,
    idIndex,
  };
}

export function getTopBlock(w: VoxelWorld, i: number, j: number): BlockId {
  const idx = j * w.width + i;
  const h = w.heights[idx];
  if (h === 0) return 'air';
  return w.palette[w.cells[idx * w.maxStackHeight + h - 1]];
}

export function getBlockAt(w: VoxelWorld, i: number, j: number, y: number): BlockId {
  if (i < 0 || i >= w.width || j < 0 || j >= w.depth) return 'air';
  if (y < 0 || y >= w.maxStackHeight) return 'air';
  return w.palette[w.cells[(j * w.width + i) * w.maxStackHeight + y]];
}

export function getColumnHeight(w: VoxelWorld, i: number, j: number): number {
  if (i < 0 || i >= w.width || j < 0 || j >= w.depth) return 0;
  return w.heights[j * w.width + i];
}

export function breakTopBlock(w: VoxelWorld, i: number, j: number): BlockId | null {
  if (i < 0 || i >= w.width || j < 0 || j >= w.depth) return null;
  const idx = j * w.width + i;
  const h = w.heights[idx];
  if (h <= 0) return null;
  const cellIdx = idx * w.maxStackHeight + (h - 1);
  const removed = w.palette[w.cells[cellIdx]];
  w.cells[cellIdx] = 0;
  w.heights[idx] = h - 1;
  return removed;
}

export function placeTopBlock(w: VoxelWorld, i: number, j: number, block: BlockId): boolean {
  if (i < 0 || i >= w.width || j < 0 || j >= w.depth) return false;
  const idx = j * w.width + i;
  const h = w.heights[idx];
  if (h >= w.maxStackHeight) return false;
  w.cells[idx * w.maxStackHeight + h] = w.idIndex.get(block) ?? 0;
  w.heights[idx] = h + 1;
  return true;
}
