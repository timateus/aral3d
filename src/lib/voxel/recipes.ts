import type { BlockId } from './block-types';

export interface Recipe {
  id: string;
  name: string;
  inputs: { block: BlockId; count: number }[];
  output: { block: BlockId; count: number };
  description: string;
}

export const RECIPES: Recipe[] = [
  {
    id: 'soap',
    name: 'Khorezm Soap',
    inputs: [
      { block: 'fat', count: 1 },
      { block: 'ash', count: 1 },
      { block: 'water', count: 1 },
    ],
    output: { block: 'soap', count: 1 },
    description: 'Cottonseed-oil tradition: fat + ash + water → soap.',
  },
  {
    id: 'sapling',
    name: 'Saxaul Saplings',
    inputs: [{ block: 'saxaul', count: 1 }],
    output: { block: 'sapling', count: 4 },
    description: 'Split saxaul wood into 4 saplings to stabilize sand.',
  },
  {
    id: 'shovel',
    name: 'Shovel',
    inputs: [{ block: 'stone', count: 2 }, { block: 'saxaul', count: 1 }],
    output: { block: 'shovel', count: 1 },
    description: 'Hold to dig sand/clay/salt faster. Useful for canals.',
  },
  {
    id: 'bucket',
    name: 'Bucket',
    inputs: [{ block: 'clay', count: 3 }],
    output: { block: 'bucket', count: 1 },
    description: 'Carries water from wells and lakes.',
  },
  {
    id: 'brick',
    name: 'Fired Brick',
    inputs: [{ block: 'clay', count: 2 }, { block: 'saxaul', count: 1 }],
    output: { block: 'brick', count: 1 },
    description: 'Bake clay with saxaul fuel into hard brick.',
  },
  {
    id: 'flatbread',
    name: 'Flatbread (Patyr)',
    inputs: [{ block: 'reed', count: 2 }, { block: 'water', count: 1 }],
    output: { block: 'flatbread', count: 2 },
    description: 'Bake bread. +40 hunger when eaten.',
  },
  {
    id: 'reed-mat',
    name: 'Reed (cluster)',
    inputs: [{ block: 'grass', count: 4 }],
    output: { block: 'reed', count: 1 },
    description: '4 grass → 1 reed bundle for canal banks.',
  },
];
