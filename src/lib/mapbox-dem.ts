import type { GeoBounds, TerrainData } from './geotiff-loader';

// --- Web Mercator tile math ---
function lon2tile(lon: number, z: number) {
  return ((lon + 180) / 360) * Math.pow(2, z);
}
function lat2tile(lat: number, z: number) {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z);
}

const TILE_SIZE = 512; // @2x
const MAX_TILES_PER_AXIS = 4; // -> at most 16 tiles, 2048×2048 raster

function pickZoom(bounds: GeoBounds): number {
  // Pick the highest zoom where the bbox tile-count stays under the cap.
  for (let z = 14; z >= 1; z--) {
    const x0 = Math.floor(lon2tile(bounds.minLon, z));
    const x1 = Math.floor(lon2tile(bounds.maxLon, z));
    const y0 = Math.floor(lat2tile(bounds.maxLat, z));
    const y1 = Math.floor(lat2tile(bounds.minLat, z));
    const cols = x1 - x0 + 1;
    const rows = y1 - y0 + 1;
    if (cols <= MAX_TILES_PER_AXIS && rows <= MAX_TILES_PER_AXIS) return z;
  }
  return 1;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load tile`));
    img.src = url;
  });
}

async function stitchTerrainTiles(bounds: GeoBounds, z: number, token: string) {
  const fx0 = lon2tile(bounds.minLon, z);
  const fx1 = lon2tile(bounds.maxLon, z);
  const fy0 = lat2tile(bounds.maxLat, z);
  const fy1 = lat2tile(bounds.minLat, z);
  const x0 = Math.floor(fx0), x1 = Math.floor(fx1);
  const y0 = Math.floor(fy0), y1 = Math.floor(fy1);
  const cols = x1 - x0 + 1, rows = y1 - y0 + 1;
  const canvas = document.createElement('canvas');
  canvas.width = cols * TILE_SIZE;
  canvas.height = rows * TILE_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const tasks: Promise<void>[] = [];
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${tx}/${ty}@2x.pngraw?access_token=${token}`;
      tasks.push(
        loadImage(url).then((img) => {
          ctx.drawImage(img, (tx - x0) * TILE_SIZE, (ty - y0) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        })
      );
    }
  }
  await Promise.all(tasks);
  // sub-pixel bbox within stitched canvas
  const u0 = (fx0 - x0) / cols;
  const u1 = (fx1 - x0) / cols;
  const v0 = (fy0 - y0) / rows;
  const v1 = (fy1 - y0) / rows;
  return { canvas, u0, v0, u1, v1 };
}

/** Loads Mapbox terrain-RGB tiles for the bbox and decodes them into a TerrainData grid. */
export async function loadMapboxDEM(
  bounds: GeoBounds,
  token: string,
  opts: { targetSize?: number } = {}
): Promise<TerrainData> {
  const target = opts.targetSize ?? 512;
  const z = pickZoom(bounds);
  const { canvas, u0, v0, u1, v1 } = await stitchTerrainTiles(bounds, z, token);

  // Crop to the exact bbox region
  const sx = u0 * canvas.width;
  const sy = v0 * canvas.height;
  const sw = (u1 - u0) * canvas.width;
  const sh = (v1 - v0) * canvas.height;

  // Resample to target grid (square-ish proportional to bbox aspect)
  const aspect = sw / sh;
  let outW: number, outH: number;
  if (aspect >= 1) { outW = target; outH = Math.max(64, Math.round(target / aspect)); }
  else { outH = target; outW = Math.max(64, Math.round(target * aspect)); }

  const out = document.createElement('canvas');
  out.width = outW; out.height = outH;
  const octx = out.getContext('2d', { willReadFrequently: true })!;
  octx.drawImage(canvas, sx, sy, sw, sh, 0, 0, outW, outH);
  const data = octx.getImageData(0, 0, outW, outH).data;

  const elevations = new Float32Array(outW * outH);
  let minE = Infinity, maxE = -Infinity;
  for (let i = 0, p = 0; p < elevations.length; i += 4, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const elev = -10000 + (r * 65536 + g * 256 + b) * 0.1;
    elevations[p] = elev;
    if (elev < minE) minE = elev;
    if (elev > maxE) maxE = elev;
  }

  return {
    width: outW,
    height: outH,
    elevations,
    minElevation: minE,
    maxElevation: maxE,
    noDataValue: null,
    bounds: { ...bounds },
  };
}
