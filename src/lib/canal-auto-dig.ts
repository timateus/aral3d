import { TerrainData } from '@/lib/geotiff-loader';

interface GeoJSONFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: number[][] | number[][][] | number[][][][];
  };
  properties: Record<string, unknown>;
}

interface GeoJSONCollection {
  type: string;
  features: GeoJSONFeature[];
}

/**
 * Convert a geo coordinate to pixel position on the terrain grid.
 */
function geoToPixel(
  lat: number,
  lon: number,
  terrain: TerrainData,
): { col: number; row: number } | null {
  const { bounds, width, height } = terrain;
  const nx = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
  const ny = (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
  const col = Math.round(nx * (width - 1));
  const row = Math.round((1 - ny) * (height - 1));
  return { col, row };
}

/**
 * Bresenham's line algorithm — returns all pixel coordinates along a line.
 */
function bresenhamLine(
  x0: number, y0: number, x1: number, y1: number
): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return points;
}

/**
 * Load GeoJSON files for the specified basin layers and dig canals into the terrain.
 * Returns the set of modified pixel indices.
 */
export async function digCanalsFromBasins(
  terrain: TerrainData,
  basins: { show13th: boolean; show19th: boolean; show21st: boolean },
  digDepth: number = 10,
  brushRadius: number = 2,
): Promise<Set<number>> {
  const urls: string[] = [];
  if (basins.show13th) urls.push('/data/13cent_basin.geojson');
  if (basins.show19th) urls.push('/data/19cent_basin.geojson');
  if (basins.show21st) urls.push('/data/21cent_basin.geojson');

  if (urls.length === 0) return new Set();

  const collections = await Promise.all(
    urls.map(url => fetch(url).then(r => r.json() as Promise<GeoJSONCollection>))
  );

  const { width, height, elevations } = terrain;
  const dugPixels = new Set<number>();

  for (const collection of collections) {
    for (const feature of collection.features) {
      let lines: number[][][] = [];
      if (feature.geometry.type === 'LineString') {
        lines = [feature.geometry.coordinates as number[][]];
      } else if (feature.geometry.type === 'MultiLineString') {
        lines = feature.geometry.coordinates as number[][][];
      } else {
        continue;
      }

      for (const line of lines) {
        // Convert all coords to pixels and trace between consecutive pairs
        const pixels: Array<{ col: number; row: number }> = [];
        for (const coord of line) {
          const p = geoToPixel(coord[1], coord[0], terrain);
          if (p) pixels.push(p);
        }

        for (let i = 0; i < pixels.length - 1; i++) {
          const linePixels = bresenhamLine(
            pixels[i].col, pixels[i].row,
            pixels[i + 1].col, pixels[i + 1].row
          );

          for (const [cx, cy] of linePixels) {
            // Apply brush radius
            for (let dr = -brushRadius; dr <= brushRadius; dr++) {
              for (let dc = -brushRadius; dc <= brushRadius; dc++) {
                const r = cy + dr;
                const c = cx + dc;
                if (r < 0 || r >= height || c < 0 || c >= width) continue;
                const dist = Math.sqrt(dr * dr + dc * dc);
                if (dist > brushRadius) continue;
                const falloff = 1 - dist / (brushRadius + 1);
                const idx = r * width + c;
                // Only dig down, don't accumulate too much
                if (!dugPixels.has(idx)) {
                  elevations[idx] -= digDepth * falloff;
                }
                dugPixels.add(idx);
              }
            }
          }
        }
      }
    }
  }

  // Recalculate min elevation
  let newMin = terrain.maxElevation;
  for (let i = 0; i < elevations.length; i++) {
    if (elevations[i] < newMin) newMin = elevations[i];
  }
  terrain.minElevation = newMin;

  return dugPixels;
}
