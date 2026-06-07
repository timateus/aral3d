// Items the player can place on the map surface in Level 5 (Map Builder).

export type MapBuilderItemId =
  | 'water'
  | 'salt'
  | 'sand'
  | 'saxaul'
  | 'reed'
  | 'saiga'
  | 'fish'
  | 'camel'
  | 'yurt'
  | 'tree';

export interface MapBuilderItem {
  id: MapBuilderItemId;
  label: string;
  emoji: string;
  color: string;
  kind: 'block' | 'creature';
}

export const MAP_BUILDER_ITEMS: MapBuilderItem[] = [
  { id: 'water',  label: 'Water',  emoji: '💧', color: '#2b6cb0', kind: 'block' },
  { id: 'salt',   label: 'Salt',   emoji: '🧂', color: '#f0eee5', kind: 'block' },
  { id: 'sand',   label: 'Sand',   emoji: '🟨', color: '#d9c389', kind: 'block' },
  { id: 'saxaul', label: 'Saxaul', emoji: '🌳', color: '#4f6b3a', kind: 'block' },
  { id: 'reed',   label: 'Reed',   emoji: '🌾', color: '#8aa45b', kind: 'block' },
  { id: 'tree',   label: 'Tree',   emoji: '🌲', color: '#2f5a2f', kind: 'block' },
  { id: 'yurt',   label: 'Yurt',   emoji: '⛺', color: '#a37a4a', kind: 'block' },
  { id: 'saiga',  label: 'Saiga',  emoji: '🦌', color: '#c9a06a', kind: 'creature' },
  { id: 'camel',  label: 'Camel',  emoji: '🐫', color: '#b88a55', kind: 'creature' },
  { id: 'fish',   label: 'Fish',   emoji: '🐟', color: '#9bc8d6', kind: 'creature' },
];

export interface PlacedItem {
  id: string;
  type: MapBuilderItemId;
  lat: number;
  lon: number;
  /** Vertical stack index — how many blocks at this cell already exist when placed (0 = ground). */
  stack?: number;
}

export function getItemDef(t: MapBuilderItemId): MapBuilderItem {
  return MAP_BUILDER_ITEMS.find(i => i.id === t) ?? MAP_BUILDER_ITEMS[0];
}

/** Snap lat/lon to a discrete grid so repeated placement at the same spot stacks. */
export const CELL_DEG = 0.0008; // ~80m — visible cube footprint
export function snapLatLon(lat: number, lon: number) {
  return {
    lat: Math.round(lat / CELL_DEG) * CELL_DEG,
    lon: Math.round(lon / CELL_DEG) * CELL_DEG,
  };
}
export function cellKey(lat: number, lon: number) {
  const s = snapLatLon(lat, lon);
  return `${s.lat.toFixed(5)}|${s.lon.toFixed(5)}`;
}
