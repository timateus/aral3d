// Items the player can place on the map surface in Level 5 (Map Builder / Sandspiel).

export type MapBuilderItemId =
  | 'water'
  | 'salt'
  | 'sand'
  | 'saxaul'
  | 'reed'
  | 'seed'
  | 'lava'
  | 'oilpump'
  | 'oil'
  | 'plant'
  | 'flower'
  | 'fire'
  | 'smoke'
  | 'camel'
  | 'fish';

export interface MapBuilderItem {
  id: MapBuilderItemId;
  label: string;
  emoji: string;
  color: string;
  kind: 'block' | 'creature';
  /** If true, hidden from the bottom palette (spawned by simulation). */
  hidden?: boolean;
}

export const MAP_BUILDER_ITEMS: MapBuilderItem[] = [
  { id: 'water',   label: 'Water',    emoji: '💧', color: '#2b6cb0', kind: 'block' },
  { id: 'salt',    label: 'Salt',     emoji: '🧂', color: '#f0eee5', kind: 'block' },
  { id: 'sand',    label: 'Sand',     emoji: '🟨', color: '#d9c389', kind: 'block' },
  { id: 'saxaul',  label: 'Saxaul',   emoji: '🌳', color: '#4f6b3a', kind: 'block' },
  { id: 'reed',    label: 'Reed',     emoji: '🌾', color: '#8aa45b', kind: 'block' },
  { id: 'seed',    label: 'Seed',     emoji: '🌱', color: '#8b6f3a', kind: 'block' },
  { id: 'lava',    label: 'Lava',     emoji: '🔥', color: '#ff5a14', kind: 'block' },
  { id: 'oilpump', label: 'Oil Pump', emoji: '⛽', color: '#2a2a2a', kind: 'block' },
  { id: 'camel',   label: 'Camel',    emoji: '🐫', color: '#b88a55', kind: 'creature' },
  { id: 'fish',    label: 'Fish',     emoji: '🐟', color: '#9bc8d6', kind: 'creature' },
  // Auto-spawned (not in palette):
  { id: 'oil',     label: 'Oil',      emoji: '🛢️', color: '#1a1410', kind: 'block', hidden: true },
  { id: 'plant',   label: 'Plant',    emoji: '🌿', color: '#4caf50', kind: 'block', hidden: true },
  { id: 'flower',  label: 'Flower',   emoji: '🌸', color: '#ff7ab8', kind: 'block', hidden: true },
  { id: 'fire',    label: 'Fire',     emoji: '🔥', color: '#ff8a14', kind: 'block', hidden: true },
  { id: 'smoke',   label: 'Smoke',    emoji: '💨', color: '#555555', kind: 'block', hidden: true },
];

export const PALETTE_ITEMS = MAP_BUILDER_ITEMS.filter((i) => !i.hidden);

export interface PlacedItem {
  id: string;
  type: MapBuilderItemId;
  lat: number;
  lon: number;
  /** Vertical stack index — how many blocks at this cell already exist when placed (0 = ground). */
  stack?: number;
  /** Optional simulation age (ticks). */
  age?: number;
}

export function getItemDef(t: MapBuilderItemId): MapBuilderItem {
  return MAP_BUILDER_ITEMS.find((i) => i.id === t) ?? MAP_BUILDER_ITEMS[0];
}

/** Snap lat/lon to a discrete grid so repeated placement at the same spot stacks. */
export const CELL_DEG = 0.02;
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

/** Block edge in world units (must match MapPlacementOverlay). */
export const CUBE_SIZE = 0.06;
