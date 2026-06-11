// Satellite imagery GeoGuessr locations.
// Coordinates parsed from Google Earth share links (the @lat,lon,alt_a,distance_d,...).
// `zoom` is the Mapbox static-tile zoom that approximates the Earth camera distance.
//   ~600m   distance → zoom 17
//   ~10000m distance → zoom 13
//   ~50000m distance → zoom 11

export interface GeoLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Mapbox static-image zoom that roughly matches the Earth view. */
  zoom: number;
  /** A short hint shown after the guess is locked in (optional). */
  hint?: string;
}

export const GEO_LOCATIONS: GeoLocation[] = [
  {
    id: 'savitsky',
    name: 'Savitsky Museum',
    lat: 42.46559,
    lon: 59.61240,
    zoom: 17,
    hint: 'Nukus — the Louvre of the Steppe.',
  },
  {
    id: 'salt-mining',
    name: 'Barsakelmes Salt Mining',
    lat: 43.36758,
    lon: 57.96974,
    zoom: 13,
    hint: 'Evaporation ponds carved out of the former seabed.',
  },
  {
    id: 'saxaul',
    name: 'Saxaul forest',
    lat: 44.01322,
    lon: 58.73721,
    zoom: 17,
    hint: 'Saxaul trees planted on the Aralkum to fight dust storms.',
  },
  {
    id: 'janpiq-qala',
    name: 'Janpiq Qala',
    lat: 42.02734,
    lon: 60.32507,
    zoom: 14,
    hint: 'Ancient fortress on the right bank of the Amu Darya.',
  },
  {
    id: 'kokaral-dam',
    name: 'Syr Darya Delta & Kokaral Dam',
    lat: 46.13594,
    lon: 60.86532,
    zoom: 10,
    hint: 'The dam saving the North Aral Sea.',
  },
  {
    id: 'qubla-ustyurt',
    name: 'Qubla-Ustyurt Settlement',
    lat: 44.02710,
    lon: 58.25278,
    zoom: 13,
    hint: 'Abandoned settlement and airport on the Ustyurt plateau.',
  },
  {
    id: 'beleuli',
    name: 'Karavan-Saray Beleuli',
    lat: 44.50407,
    lon: 57.11523,
    zoom: 17,
    hint: 'Silk Road caravanserai on the Ustyurt plateau.',
  },
  {
    id: 'jasliq',
    name: 'Jasliq Train Station (and Mukhasan\'s Aul)',
    lat: 43.97240,
    lon: 57.48918,
    zoom: 16,
    hint: 'Railway stop on the edge of the Ustyurt plateau.',
  },
  {
    id: 'aq-keme',
    name: 'Aq Keme ("White Boat") Kid\'s Summer Camp',
    lat: 43.60033,
    lon: 58.99548,
    zoom: 16,
    hint: 'Children\'s summer camp near the former Aral shoreline.',
  },
];

const MAPBOX_TOKEN =
  'pk.eyJ1IjoidGltYXRldXMiLCJhIjoiY2s2ZmhwMzd2MGNsbjNsbHJjeW9jeTZjeiJ9.nz7s6DdDjUYWUFSpVjFYaw';

export function satelliteImageUrl(loc: GeoLocation, w = 640, h = 480): string {
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${loc.lon},${loc.lat},${loc.zoom},0/${w}x${h}@2x?access_token=${MAPBOX_TOKEN}&attribution=false&logo=false`;
}

/**
 * Warm the browser image cache for every GeoGuessr satellite reference image.
 * Safe to call repeatedly — uses a module-level flag plus the browser HTTP cache.
 * Called from earlier levels so the first photo of level 4 never shows a blank.
 */
let preloadStarted = false;
export function preloadGeoGuessrImages(): void {
  if (preloadStarted || typeof window === 'undefined') return;
  preloadStarted = true;
  for (const loc of GEO_LOCATIONS) {
    const img = new Image();
    img.decoding = 'async';
    img.src = satelliteImageUrl(loc, 480, 360);
  }
}

/** Great-circle distance in km between two lat/lon points. */
export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Score 0–5000 based on distance (5000 at 0 km, 0 at >=300 km). */
export function scoreFor(distanceKm: number): number {
  const max = 300;
  const x = Math.max(0, 1 - distanceKm / max);
  return Math.round(5000 * x * x);
}
