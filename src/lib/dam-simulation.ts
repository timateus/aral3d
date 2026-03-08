import { TerrainData } from '@/lib/geotiff-loader';

export interface ReservoirResult {
  floodedPixels: Set<number>;
  volume: number;       // km³
  surfaceArea: number;  // km²
  maxDepth: number;     // meters
  crestElevation: number;
}

interface PixelCoord {
  row: number;
  col: number;
}

/**
 * Convert geo coordinates to pixel indices in the terrain grid.
 */
function geoToPixel(lat: number, lon: number, terrain: TerrainData): PixelCoord | null {
  const { bounds, width, height } = terrain;
  if (!bounds) return null;
  const col = Math.round(((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * (width - 1));
  const row = Math.round(((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * (height - 1));
  if (col < 0 || col >= width || row < 0 || row >= height) return null;
  return { row, col };
}

/**
 * Get the set of pixel indices that form the dam barrier line.
 * Uses Bresenham's line algorithm across the dam width.
 */
function getDamBarrierPixels(
  terrain: TerrainData,
  damLat: number,
  damLon: number,
  damWidthMeters: number,
  orientationDeg: number
): Set<number> {
  const barrier = new Set<number>();
  const { bounds, width, height } = terrain;
  if (!bounds) return barrier;

  // Convert dam width from meters to degrees (approximate)
  const metersPerDegLon = 111320 * Math.cos((damLat * Math.PI) / 180);
  const metersPerDegLat = 110540;
  const halfWidthLon = (damWidthMeters / 2) / metersPerDegLon;
  const halfWidthLat = (damWidthMeters / 2) / metersPerDegLat;

  const rad = (orientationDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);

  // Sample points along the dam line
  const numSamples = Math.max(20, Math.round(damWidthMeters / 30));
  for (let i = 0; i <= numSamples; i++) {
    const t = (i / numSamples) * 2 - 1; // -1 to 1
    const lon = damLon + t * halfWidthLon * dx;
    const lat = damLat + t * halfWidthLat * dy;
    const px = geoToPixel(lat, lon, terrain);
    if (px) {
      // Add a small thickness (3 pixels) to the barrier
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = px.row + dr;
          const c = px.col + dc;
          if (r >= 0 && r < height && c >= 0 && c < width) {
            barrier.add(r * width + c);
          }
        }
      }
    }
  }
  return barrier;
}

/**
 * Auto-detect dam orientation perpendicular to the steepest gradient at the dam location.
 */
function autoDetectOrientation(terrain: TerrainData, damLat: number, damLon: number): number {
  const px = geoToPixel(damLat, damLon, terrain);
  if (!px) return 0;
  const { width, height, elevations } = terrain;
  const { row, col } = px;

  // Compute gradient using neighboring pixels
  const getElev = (r: number, c: number) => {
    if (r < 0 || r >= height || c < 0 || c >= width) return 0;
    return elevations[r * width + c];
  };

  const dEdx = getElev(row, col + 1) - getElev(row, col - 1);
  const dEdy = getElev(row + 1, col) - getElev(row - 1, col);

  // Gradient direction in degrees, dam should be perpendicular
  const gradAngle = Math.atan2(dEdy, dEdx) * (180 / Math.PI);
  return gradAngle + 90; // perpendicular to gradient = across the valley
}

/**
 * Find the seed point on the upstream (lower elevation) side of the dam.
 */
function findSeedPoint(
  terrain: TerrainData,
  damLat: number,
  damLon: number,
  orientationDeg: number
): PixelCoord | null {
  const { bounds, width, height, elevations } = terrain;
  if (!bounds) return null;

  const metersPerDegLon = 111320 * Math.cos((damLat * Math.PI) / 180);
  const metersPerDegLat = 110540;

  // Check both sides of the dam (perpendicular to the dam orientation)
  const rad = (orientationDeg * Math.PI) / 180;
  // Normal to dam line
  const nx = -Math.sin(rad);
  const ny = Math.cos(rad);

  const offsetDeg = 500; // 500 meters offset
  const side1Lon = damLon + (nx * offsetDeg) / metersPerDegLon;
  const side1Lat = damLat + (ny * offsetDeg) / metersPerDegLat;
  const side2Lon = damLon - (nx * offsetDeg) / metersPerDegLon;
  const side2Lat = damLat - (ny * offsetDeg) / metersPerDegLat;

  const px1 = geoToPixel(side1Lat, side1Lon, terrain);
  const px2 = geoToPixel(side2Lat, side2Lon, terrain);

  if (!px1 && !px2) return null;
  if (!px1) return px2;
  if (!px2) return px1;

  const e1 = elevations[px1.row * width + px1.col];
  const e2 = elevations[px2.row * width + px2.col];

  // Seed on the lower side (upstream, where water accumulates)
  return e1 < e2 ? px1 : px2;
}

/**
 * Run BFS flood-fill simulation from the seed point.
 * Water fills all connected pixels with elevation < crestElevation,
 * stopping at the dam barrier and at terrain above crest height.
 */
export function simulateReservoir(
  terrain: TerrainData,
  damLat: number,
  damLon: number,
  damHeightMeters: number,
  damWidthMeters: number = 200,
  orientationDeg?: number
): ReservoirResult | null {
  const { width, height, elevations, bounds, noDataValue } = terrain;
  if (!bounds) return null;

  const orientation = orientationDeg ?? autoDetectOrientation(terrain, damLat, damLon);

  // Dam location elevation
  const damPx = geoToPixel(damLat, damLon, terrain);
  if (!damPx) return null;
  const damBaseElev = elevations[damPx.row * width + damPx.col];
  const crestElevation = damBaseElev + damHeightMeters;

  // Get dam barrier pixels
  const barrierPixels = getDamBarrierPixels(terrain, damLat, damLon, damWidthMeters, orientation);

  // Find seed point
  const seed = findSeedPoint(terrain, damLat, damLon, orientation);
  if (!seed) return null;

  // BFS flood fill
  const floodedPixels = new Set<number>();
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const seedIdx = seed.row * width + seed.col;
  const seedElev = elevations[seedIdx];
  if (seedElev >= crestElevation) return null; // seed is above crest, no reservoir

  queue.push(seedIdx);
  visited[seedIdx] = 1;

  while (queue.length > 0) {
    const idx = queue.shift()!;
    const elev = elevations[idx];

    // Skip nodata
    if (noDataValue !== null && elev === noDataValue) continue;
    if (isNaN(elev) || elev <= -9999) continue;

    // Skip if above crest elevation
    if (elev >= crestElevation) continue;

    // Skip if this is a barrier pixel
    if (barrierPixels.has(idx)) continue;

    floodedPixels.add(idx);

    // Expand to 4-connected neighbors
    const row = Math.floor(idx / width);
    const col = idx % width;
    const neighbors = [
      row > 0 ? (row - 1) * width + col : -1,
      row < height - 1 ? (row + 1) * width + col : -1,
      col > 0 ? row * width + (col - 1) : -1,
      col < width - 1 ? row * width + (col + 1) : -1,
    ];

    for (const nIdx of neighbors) {
      if (nIdx < 0 || visited[nIdx]) continue;
      visited[nIdx] = 1;
      const nElev = elevations[nIdx];
      if (noDataValue !== null && nElev === noDataValue) continue;
      if (isNaN(nElev) || nElev <= -9999) continue;
      if (nElev < crestElevation && !barrierPixels.has(nIdx)) {
        queue.push(nIdx);
      }
    }
  }

  if (floodedPixels.size === 0) return null;

  // Calculate volume, surface area, and max depth
  const lonRange = bounds.maxLon - bounds.minLon;
  const latRange = bounds.maxLat - bounds.minLat;
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const pixelWidthM = (lonRange / width) * 111320 * Math.cos((centerLat * Math.PI) / 180);
  const pixelHeightM = (latRange / height) * 110540;
  const pixelAreaM2 = pixelWidthM * pixelHeightM;

  let totalVolumeM3 = 0;
  let maxDepth = 0;

  for (const idx of floodedPixels) {
    const elev = elevations[idx];
    const depth = crestElevation - elev;
    totalVolumeM3 += depth * pixelAreaM2;
    if (depth > maxDepth) maxDepth = depth;
  }

  const volumeKm3 = totalVolumeM3 / 1e9;
  const surfaceAreaKm2 = (floodedPixels.size * pixelAreaM2) / 1e6;

  return {
    floodedPixels,
    volume: volumeKm3,
    surfaceArea: surfaceAreaKm2,
    maxDepth,
    crestElevation,
  };
}
