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
    id: 'reed-mat',
    name: 'Reed (cluster)',
    inputs: [{ block: 'grass', count: 4 }],
    output: { block: 'reed', count: 1 },
    description: '4 grass → 1 reed bundle for canal banks.',
  },
  {
    id: 'clay-fired',
    name: 'Fired Clay (stone)',
    inputs: [{ block: 'clay', count: 4 }],
    output: { block: 'stone', count: 1 },
    description: 'Fire clay into a hard stone-equivalent brick.',
  },
];
