import { TerrainData } from './geotiff-loader';

/**
 * Export terrain as a binary STL suitable for 3D printing.
 * - Downsamples to ~150x150 grid for low polycount
 * - Applies x30 vertical exaggeration (true scale relative to horizontal)
 * - Scales to fit a 220x220mm print bed
 * - Adds a solid base underneath
 * - Y-axis flipped so north faces the correct direction
 */
export function exportTerrainSTL(terrain: TerrainData): Blob {
  const { width, height, elevations, minElevation, maxElevation, noDataValue, bounds } = terrain;

  // Downsample to ~150 for manageable polycount
  const TARGET = 150;
  const stepX = Math.max(1, Math.floor(width / TARGET));
  const stepY = Math.max(1, Math.floor(height / TARGET));
  const w = Math.floor((width - 1) / stepX) + 1;
  const h = Math.floor((height - 1) / stepY) + 1;

  const EXAGGERATION = 300;
  const BED_MM = 220; // mm
  const BASE_THICKNESS_MM = 3; // solid base below lowest point

  // Compute real-world extent in km (approximate)
  const latSpanDeg = bounds.maxLat - bounds.minLat;
  const lonSpanDeg = bounds.maxLon - bounds.minLon;
  const avgLat = (bounds.maxLat + bounds.minLat) / 2;
  const kmPerDegLat = 111.32;
  const kmPerDegLon = 111.32 * Math.cos((avgLat * Math.PI) / 180);
  const extentNS_km = latSpanDeg * kmPerDegLat;
  const extentEW_km = lonSpanDeg * kmPerDegLon;
  const maxExtent_km = Math.max(extentEW_km, extentNS_km);

  // Scale: longest real-world side maps to BED_MM
  const mmPerKm = BED_MM / maxExtent_km;
  // Elevation in km, exaggerated, then to mm
  const elevToMM = (elev: number) =>
    ((elev - minElevation) / 1000) * EXAGGERATION * mmPerKm;

  // Build elevation grid (downsampled), flipping Y so north = +Y in STL
  const grid: number[][] = [];
  for (let j = 0; j < h; j++) {
    const row: number[] = [];
    for (let i = 0; i < w; i++) {
      const srcX = Math.min(i * stepX, width - 1);
      // Flip: j=0 in STL = last row in raster (south), j=h-1 = first row (north)
      const srcY = Math.min((h - 1 - j) * stepY, height - 1);
      let elev = elevations[srcY * width + srcX];
      if (isNaN(elev) || (noDataValue !== null && elev === noDataValue) || elev <= -9999) {
        elev = minElevation;
      }
      row.push(elev);
    }
    grid.push(row);
  }

  // XY scale: grid cells to mm
  const cellX_mm = (extentEW_km / (w - 1)) * mmPerKm;
  const cellY_mm = (extentNS_km / (h - 1)) * mmPerKm;

  function getX(i: number): number {
    return i * cellX_mm;
  }
  function getY(j: number): number {
    return j * cellY_mm;
  }
  function getZ(j: number, i: number): number {
    return BASE_THICKNESS_MM + elevToMM(grid[j][i]);
  }

  const baseZ = 0;

  // Count triangles: top + bottom + 4 walls
  const topTris = (w - 1) * (h - 1) * 2;
  const bottomTris = (w - 1) * (h - 1) * 2;
  const sideTris = ((w - 1) + (w - 1) + (h - 1) + (h - 1)) * 2;
  const totalTris = topTris + bottomTris + sideTris;

  const bufferSize = 80 + 4 + totalTris * 50;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // Header
  const header = 'Aral Sea Terrain STL - 220mm x30';
  for (let i = 0; i < 80; i++) {
    view.setUint8(i, i < header.length ? header.charCodeAt(i) : 0);
  }
  view.setUint32(80, totalTris, true);

  let offset = 84;

  function writeTri(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number
  ) {
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= len; ny /= len; nz /= len;

    view.setFloat32(offset, nx, true); offset += 4;
    view.setFloat32(offset, ny, true); offset += 4;
    view.setFloat32(offset, nz, true); offset += 4;
    view.setFloat32(offset, ax, true); offset += 4;
    view.setFloat32(offset, ay, true); offset += 4;
    view.setFloat32(offset, az, true); offset += 4;
    view.setFloat32(offset, bx, true); offset += 4;
    view.setFloat32(offset, by, true); offset += 4;
    view.setFloat32(offset, bz, true); offset += 4;
    view.setFloat32(offset, cx, true); offset += 4;
    view.setFloat32(offset, cy, true); offset += 4;
    view.setFloat32(offset, cz, true); offset += 4;
    view.setUint16(offset, 0, true); offset += 2;
  }

  // Top surface
  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const x0 = getX(i), x1 = getX(i + 1);
      const y0 = getY(j), y1 = getY(j + 1);
      writeTri(x0, y0, getZ(j, i), x1, y0, getZ(j, i + 1), x0, y1, getZ(j + 1, i));
      writeTri(x1, y0, getZ(j, i + 1), x1, y1, getZ(j + 1, i + 1), x0, y1, getZ(j + 1, i));
    }
  }

  // Bottom surface (normals face down)
  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const x0 = getX(i), x1 = getX(i + 1);
      const y0 = getY(j), y1 = getY(j + 1);
      writeTri(x0, y0, baseZ, x0, y1, baseZ, x1, y0, baseZ);
      writeTri(x1, y0, baseZ, x0, y1, baseZ, x1, y1, baseZ);
    }
  }

  // Side walls
  for (let i = 0; i < w - 1; i++) {
    const x0 = getX(i), x1 = getX(i + 1);
    // Front (j=0)
    const yf = getY(0);
    writeTri(x0, yf, baseZ, x1, yf, baseZ, x0, yf, getZ(0, i));
    writeTri(x1, yf, baseZ, x1, yf, getZ(0, i + 1), x0, yf, getZ(0, i));
    // Back (j=h-1)
    const yb = getY(h - 1);
    writeTri(x0, yb, baseZ, x0, yb, getZ(h - 1, i), x1, yb, baseZ);
    writeTri(x1, yb, baseZ, x0, yb, getZ(h - 1, i), x1, yb, getZ(h - 1, i + 1));
  }
  for (let j = 0; j < h - 1; j++) {
    const y0 = getY(j), y1 = getY(j + 1);
    // Left (i=0)
    const xl = getX(0);
    writeTri(xl, y0, baseZ, xl, y0, getZ(j, 0), xl, y1, baseZ);
    writeTri(xl, y1, baseZ, xl, y0, getZ(j, 0), xl, y1, getZ(j + 1, 0));
    // Right (i=w-1)
    const xr = getX(w - 1);
    writeTri(xr, y0, baseZ, xr, y1, baseZ, xr, y0, getZ(j, w - 1));
    writeTri(xr, y1, baseZ, xr, y1, getZ(j + 1, w - 1), xr, y0, getZ(j, w - 1));
  }

  return new Blob([buffer], { type: 'application/octet-stream' });
}
