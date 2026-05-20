// Block types for voxel "Survive" mode.

export type BlockId =
  | 'air'
  | 'water'
  | 'sand'
  | 'salt'
  | 'dirt'
  | 'stone'
  | 'grass'
  | 'reed'
  | 'saxaul'
  | 'clay'
  | 'mud'
  | 'snow'
  | 'fat'
  | 'ash'
  | 'milk'
  | 'soap'
  | 'sapling'
  | 'brick'
  | 'fish'
  | 'flatbread'
  | 'shovel'
  | 'bucket';

export interface BlockDef {
  id: BlockId;
  label: string;
  color: string;
  mineable: boolean;
  placeable: boolean;
  solid: boolean;
  emissive?: boolean;
}

export const BLOCKS: Record<BlockId, BlockDef> = {
  air:       { id: 'air',       label: 'Air',       color: '#000000', mineable: false, placeable: false, solid: false },
  water:     { id: 'water',     label: 'Water',     color: '#2b6cb0', mineable: true,  placeable: true,  solid: false },
  sand:      { id: 'sand',      label: 'Sand',      color: '#d9c389', mineable: true,  placeable: true,  solid: true },
  salt:      { id: 'salt',      label: 'Salt',      color: '#f0eee5', mineable: true,  placeable: true,  solid: true },
  dirt:      { id: 'dirt',      label: 'Dirt',      color: '#7a5a3a', mineable: true,  placeable: true,  solid: true },
  stone:     { id: 'stone',     label: 'Stone',     color: '#6a6a72', mineable: true,  placeable: true,  solid: true },
  grass:     { id: 'grass',     label: 'Grass',     color: '#6b8a4a', mineable: true,  placeable: true,  solid: true },
  reed:      { id: 'reed',      label: 'Reed',      color: '#8aa45b', mineable: true,  placeable: true,  solid: true },
  saxaul:    { id: 'saxaul',    label: 'Saxaul',    color: '#4f6b3a', mineable: true,  placeable: true,  solid: true },
  clay:      { id: 'clay',      label: 'Clay',      color: '#b07a55', mineable: true,  placeable: true,  solid: true },
  mud:       { id: 'mud',       label: 'Mud',       color: '#4a3a2a', mineable: true,  placeable: true,  solid: true },
  snow:      { id: 'snow',      label: 'Snow',      color: '#eaf0f4', mineable: true,  placeable: true,  solid: true },
  fat:       { id: 'fat',       label: 'Fat',       color: '#f7e6b7', mineable: false, placeable: false, solid: false },
  ash:       { id: 'ash',       label: 'Ash',       color: '#6c6963', mineable: false, placeable: false, solid: false },
  milk:      { id: 'milk',      label: 'Milk',      color: '#f5f3ec', mineable: false, placeable: false, solid: false },
  soap:      { id: 'soap',      label: 'Soap',      color: '#cfe7f4', mineable: false, placeable: true,  solid: true, emissive: true },
  sapling:   { id: 'sapling',   label: 'Sapling',   color: '#3d5a25', mineable: true,  placeable: true,  solid: false },
  brick:     { id: 'brick',     label: 'Brick',     color: '#a04a2a', mineable: true,  placeable: true,  solid: true },
  fish:      { id: 'fish',      label: 'Fish',      color: '#9bb8c8', mineable: false, placeable: false, solid: false },
  flatbread: { id: 'flatbread', label: 'Flatbread', color: '#d6b878', mineable: false, placeable: false, solid: false },
  shovel:    { id: 'shovel',    label: 'Shovel',    color: '#9b7a4a', mineable: false, placeable: false, solid: false },
  bucket:    { id: 'bucket',    label: 'Bucket',    color: '#aa7050', mineable: false, placeable: false, solid: false },
};

export const RENDERABLE_BLOCKS: BlockId[] = [
  'water','sand','salt','dirt','stone','grass','reed','saxaul','clay','mud','snow','soap','sapling','brick',
];

export const COLLECTABLE_BLOCKS: BlockId[] = [
  'water','sand','salt','dirt','stone','grass','reed','saxaul','clay','mud','snow','soap','sapling','brick',
];
