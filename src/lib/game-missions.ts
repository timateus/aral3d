import { TerrainData } from '@/lib/geotiff-loader';

export interface Mission {
  id: string;
  level: number;
  title: string;
  description: string;
  hint: string;
  /** Target lat/lon the avatar must reach */
  targetLat: number;
  targetLon: number;
  /** How close the avatar must be (in mesh units) */
  radius: number;
  /** Validation: some missions need extra logic */
  validate?: (terrain: TerrainData, avatarWorldX: number, avatarWorldZ: number) => boolean;
  reward: string;
  emoji: string;
}

/**
 * Find the pixel with the highest elevation in the terrain.
 */
export function findHighestPoint(terrain: TerrainData): { lat: number; lon: number; elev: number } {
  const { elevations, width, height, bounds, noDataValue } = terrain;
  if (!bounds) return { lat: 0, lon: 0, elev: 0 };

  let maxElev = -Infinity;
  let maxIdx = 0;
  for (let i = 0; i < elevations.length; i++) {
    const e = elevations[i];
    if (noDataValue !== null && e === noDataValue) continue;
    if (isNaN(e)) continue;
    if (e > maxElev) {
      maxElev = e;
      maxIdx = i;
    }
  }

  const row = Math.floor(maxIdx / width);
  const col = maxIdx % width;
  const nx = col / (width - 1);
  const ny = 1 - row / (height - 1);
  const lat = bounds.minLat + ny * (bounds.maxLat - bounds.minLat);
  const lon = bounds.minLon + nx * (bounds.maxLon - bounds.minLon);

  return { lat, lon, elev: maxElev };
}

/**
 * Find the pixel with the lowest elevation (excluding nodata).
 */
export function findLowestPoint(terrain: TerrainData): { lat: number; lon: number; elev: number } {
  const { elevations, width, height, bounds, noDataValue } = terrain;
  if (!bounds) return { lat: 0, lon: 0, elev: 0 };

  let minElev = Infinity;
  let minIdx = 0;
  for (let i = 0; i < elevations.length; i++) {
    const e = elevations[i];
    if (noDataValue !== null && e === noDataValue) continue;
    if (isNaN(e) || e <= -9999) continue;
    if (e < minElev) {
      minElev = e;
      minIdx = i;
    }
  }

  const row = Math.floor(minIdx / width);
  const col = minIdx % width;
  const nx = col / (width - 1);
  const ny = 1 - row / (height - 1);
  const lat = bounds.minLat + ny * (bounds.maxLat - bounds.minLat);
  const lon = bounds.minLon + nx * (bounds.maxLon - bounds.minLon);

  return { lat, lon, elev: minElev };
}

export function buildMissions(terrain: TerrainData): Mission[] {
  const highest = findHighestPoint(terrain);
  const lowest = findLowestPoint(terrain);

  return [
    {
      id: 'mission-1',
      level: 1,
      title: 'Reach the Summit',
      description: 'Find the highest point in the region.',
      hint: `Head towards elevation ${Math.round(highest.elev)}m — the tallest peak!`,
      targetLat: highest.lat,
      targetLon: highest.lon,
      radius: 0.4,
      reward: '🏔️ Summit conquered!',
      emoji: '🏔️',
    },
    {
      id: 'mission-2',
      level: 2,
      title: 'Into the Depths',
      description: 'Find the lowest point — the old seabed.',
      hint: `Descend to ${Math.round(lowest.elev)}m — the deepest basin.`,
      targetLat: lowest.lat,
      targetLon: lowest.lon,
      radius: 0.4,
      reward: '🌊 Seabed discovered!',
      emoji: '🕳️',
    },
    {
      id: 'mission-3',
      level: 3,
      title: 'Visit Nukus',
      description: 'Travel to the capital of Karakalpakstan.',
      hint: 'Head southeast — Nukus is a major city on the Amu Darya.',
      targetLat: 42.46,
      targetLon: 59.6,
      radius: 0.35,
      reward: '🏙️ Welcome to Nukus!',
      emoji: '🏙️',
    },
    {
      id: 'mission-4',
      level: 4,
      title: 'The Aral Shore',
      description: 'Reach the former coastline of the Aral Sea.',
      hint: 'Head north toward the dried Aral Sea basin.',
      targetLat: 44.0,
      targetLon: 58.5,
      radius: 0.5,
      reward: '🏖️ You stand where waves once crashed.',
      emoji: '🏖️',
    },
    {
      id: 'mission-5',
      level: 5,
      title: 'Water Bringer',
      description: 'Pour water at the lowest point to refill it!',
      hint: 'Go to the deepest basin and press SPACE to pour water.',
      targetLat: lowest.lat,
      targetLon: lowest.lon,
      radius: 0.5,
      reward: '💧 The waters return! You brought life back.',
      emoji: '💧',
    },
  ];
}
