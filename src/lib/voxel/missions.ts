// Mission definitions for Survive v2.

export type MissionEvent =
  | { type: 'mine'; block: string }
  | { type: 'place'; block: string }
  | { type: 'craft'; item: string }
  | { type: 'milk' }
  | { type: 'drink' }
  | { type: 'plant-sapling' }
  | { type: 'canal-fill'; cells: number }
  | { type: 'mature-saxaul'; count: number }
  | { type: 'place-structure'; id: string };

export interface Mission {
  id: string;
  title: string;
  hint: string;
  target: number;
  // Returns 1 if event counts toward this mission, else 0.
  match: (e: MissionEvent) => number;
}

export const MISSIONS: Mission[] = [
  {
    id: 'thirsty',
    title: 'Thirsty',
    hint: 'Press F while looking at water to drink.',
    target: 1,
    match: (e) => e.type === 'drink' ? 1 : 0,
  },
  {
    id: 'salt',
    title: 'Salt of the Earth',
    hint: 'Mine 10 salt blocks (white flats).',
    target: 10,
    match: (e) => e.type === 'mine' && e.block === 'salt' ? 1 : 0,
  },
  {
    id: 'camel',
    title: 'Camel Friend',
    hint: 'Walk up to a camel and press M to milk.',
    target: 3,
    match: (e) => e.type === 'milk' ? 1 : 0,
  },
  {
    id: 'soap',
    title: 'First Soap',
    hint: 'Mine saxaul for ash + fat, then craft soap.',
    target: 1,
    match: (e) => e.type === 'craft' && e.item === 'soap' ? 1 : 0,
  },
  {
    id: 'plant',
    title: 'Green Thumb',
    hint: 'Plant 5 saplings on sand or salt.',
    target: 5,
    match: (e) => e.type === 'plant-sapling' ? 1 : 0,
  },
  {
    id: 'canal',
    title: 'Lifeline',
    hint: 'Dig a trench that fills with at least 8 canal cells.',
    target: 8,
    match: (e) => e.type === 'canal-fill' ? e.cells : 0,
  },
  {
    id: 'restore',
    title: 'Restoration',
    hint: 'Grow 5 mature saxaul trees.',
    target: 5,
    match: (e) => e.type === 'mature-saxaul' ? e.count : 0,
  },
];
