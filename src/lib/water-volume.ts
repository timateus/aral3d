import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';

/**
 * Calculate water volume based on the water level slider.
 * Sums up (waterLevel - elevation) for every pixel below waterLevel.
 * Returns volume in km³.
 */
export function calcVolumeFromWaterLevel(terrain: TerrainData, waterLevel: number): number {
  if (!terrain.bounds) return 0;

  const { minLon, maxLon, minLat, maxLat } = terrain.bounds;
  // Approximate pixel area in m²
  const midLat = (minLat + maxLat) / 2;
  const degLonM = 111_320 * Math.cos((midLat * Math.PI) / 180); // m per degree longitude
  const degLatM = 110_540; // m per degree latitude (approx)

  const pixelLonDeg = (maxLon - minLon) / terrain.width;
  const pixelLatDeg = (maxLat - minLat) / terrain.height;
  const pixelAreaM2 = pixelLonDeg * degLonM * pixelLatDeg * degLatM;

  let volumeM3 = 0;
  for (let i = 0; i < terrain.elevations.length; i++) {
    let elev = terrain.elevations[i];
    if (terrain.noDataValue !== null && elev === terrain.noDataValue) continue;
    if (isNaN(elev) || elev <= -9999) continue;
    if (elev < waterLevel) {
      volumeM3 += (waterLevel - elev) * pixelAreaM2;
    }
  }

  return volumeM3 / 1e9; // convert m³ to km³
}

/**
 * Calculate water volume based on water extent polygons for a given year.
 * Uses point-in-polygon test for each terrain pixel within the polygon bounds,
 * summing (waterLevel - elevation) where elevation < waterLevel inside the polygon.
 * Returns volume in km³.
 */
export function calcVolumeFromExtent(
  terrain: TerrainData,
  waterLevel: number,
  geojson: { features: { geometry: { type: string; coordinates: any } }[] } | null,
): number {
  if (!terrain.bounds || !geojson) return 0;

  const { minLon, maxLon, minLat, maxLat } = terrain.bounds;
  const midLat = (minLat + maxLat) / 2;
  const degLonM = 111_320 * Math.cos((midLat * Math.PI) / 180);
  const degLatM = 110_540;

  const pixelLonDeg = (maxLon - minLon) / terrain.width;
  const pixelLatDeg = (maxLat - minLat) / terrain.height;
  const pixelAreaM2 = pixelLonDeg * degLonM * pixelLatDeg * degLatM;

  // Collect all polygon rings
  const allRings: number[][][] = [];
  for (const feature of geojson.features) {
    if (feature.geometry.type === 'Polygon') {
      allRings.push(...(feature.geometry.coordinates as number[][][]));
    } else if (feature.geometry.type === 'MultiPolygon') {
      for (const poly of feature.geometry.coordinates as number[][][][]) {
        allRings.push(...poly);
      }
    }
  }

  if (allRings.length === 0) return 0;

  let volumeM3 = 0;

  for (let py = 0; py < terrain.height; py++) {
    for (let px = 0; px < terrain.width; px++) {
      const idx = py * terrain.width + px;
      let elev = terrain.elevations[idx];
      if (terrain.noDataValue !== null && elev === terrain.noDataValue) continue;
      if (isNaN(elev) || elev <= -9999) continue;

      // Pixel center in geo coordinates
      const lon = minLon + (px + 0.5) * pixelLonDeg;
      const lat = maxLat - (py + 0.5) * pixelLatDeg;

      // Check if point is inside any ring (simplified: outer rings add, holes subtract)
      let inside = false;
      for (const ring of allRings) {
        if (pointInRing(lon, lat, ring)) inside = !inside;
      }

      if (inside && elev < waterLevel) {
        volumeM3 += (waterLevel - elev) * pixelAreaM2;
      }
    }
  }

  return volumeM3 / 1e9;
}

/** Ray casting point-in-polygon */
function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
