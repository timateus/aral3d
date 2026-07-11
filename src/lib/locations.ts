import type { GeoBounds } from './geotiff-loader';

/**
 * Location registry. To add a new location, append an entry here and it will
 * automatically be available at `/{slug}` (see `src/pages/LocationPage.tsx`
 * and the route in `src/App.tsx`).
 */
export interface LocationDef {
  slug: string;
  label: string;
  center: { lat: number; lon: number };
  /** Bounding box for terrain, satellite, and vector layers. */
  bounds: GeoBounds;
  /** Optional default vertical exaggeration (1–30). */
  exaggeration?: number;
}

/**
 * Build a square-ish bounding box of roughly `sizeKm` on a side around a
 * lon/lat center. Compensates for latitude on the longitude axis.
 */
export function bboxAround(lat: number, lon: number, sizeKm: number): GeoBounds {
  const latDelta = sizeKm / 111; // ~111 km per degree of latitude
  const lonDelta = sizeKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - latDelta / 2,
    maxLat: lat + latDelta / 2,
    minLon: lon - lonDelta / 2,
    maxLon: lon + lonDelta / 2,
  };
}

export const LOCATIONS: LocationDef[] = [
  {
    slug: 'suaq',
    label: 'Suaq',
    center: { lat: 43.3463873, lon: 79.0569679 },
    // ~2 km on a side ≈ 4 sq km, covers the requested ~3 sq km area.
    bounds: bboxAround(43.3463873, 79.0569679, 2.0),
    exaggeration: 4,
  },
];

export function findLocation(slug: string): LocationDef | undefined {
  return LOCATIONS.find((l) => l.slug === slug);
}
