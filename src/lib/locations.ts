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
    // Exact bounds from maps3d.io link (sw / ne).
    center: { lat: (43.33403 + 43.36792) / 2, lon: (79.03803 + 79.09781) / 2 },
    bounds: {
      minLat: 43.33403,
      maxLat: 43.36792,
      minLon: 79.03803,
      maxLon: 79.09781,
    },
    exaggeration: 30,
  },
];

export function findLocation(slug: string): LocationDef | undefined {
  return LOCATIONS.find((l) => l.slug === slug);
}
