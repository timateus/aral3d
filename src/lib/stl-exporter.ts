import { TerrainData } from './geotiff-loader';

/**
 * Export terrain as a binary STL suitable for 3D printing.
 * - Downsamples to ~150x150 grid for low polycount
 * - Applies x30 vertical exaggeration
 * - Scales to fit a 220x220mm print bed
 * - Adds a solid base underneath
 */
export function exportTerrainSTL(terrain: TerrainData): Blob {
  const { width, height, elevations, minElevation, maxElevation, noDataValue } = terrain;

  // Downsample to ~150 for manageable polycount
  const TARGET = 150;
  const stepX = Math.max(1, Math.floor(width / TARGET));
  const stepY = Math.max(1, Math.floor(height / TARGET));
  const w = Math.floor((width - 1) / stepX) + 1;
  const h = Math.floor((height - 1) / stepY) + 1;

  const EXAGGERATION = 30;
  const BED_MM = 220; // mm
  const BASE_THICKNESS_MM = 3; // solid base below lowest point

  const elevRange = maxElevation - minElevation || 1;
  // Height in mm for the terrain relief (exaggerated)
  const terrainHeightMM = (elevRange * EXAGGERATION) / elevRange * 20; // ~20mm relief height
  const RELIEF_MM = 20; // max terrain relief height in mm

  // Build elevation grid (downsampled)
  const grid: number[][] = [];
  for (let j = 0; j < h; j++) {
    const row: number[] = [];
    for (let i = 0; i < w; i++) {
      const srcX = Math.min(i * stepX, width - 1);
      const srcY = Math.min(j * stepY, height - 1);
      let elev = elevations[srcY * width + srcX];
      if (isNaN(elev) || (noDataValue !== null && elev === noDataValue) || elev <= -9999) {
        elev = minElevation;
      }
      row.push(elev);
    }
    grid.push(row);
  }

  // Scale factors: fit longest side to BED_MM
  const aspect = h / w;
  const scaleXY = BED_MM / Math.max(w - 1, (h - 1));
  const scaleZ = (RELIEF_MM / elevRange) * EXAGGERATION;
  const baseZ = 0; // bottom of the base at z=0

  // Helper: get z position for grid point
  function getZ(j: number, i: number): number {
    const normalized = (grid[j][i] - minElevation) / elevRange;
    return BASE_THICKNESS_MM + normalized * RELIEF_MM * (EXAGGERATION / 30);
  }

  function getX(i: number): number {
    return i * scaleXY;
  }

  function getY(j: number): number {
    return j * scaleXY;
  }

  // Count triangles: top surface + bottom surface + 4 side walls
  const topTris = (w - 1) * (h - 1) * 2;
  const bottomTris = (w - 1) * (h - 1) * 2;
  const sideTris = ((w - 1) * 2 + (h - 1) * 2) * 2; // each edge segment = 2 tris
  const totalTris = topTris + bottomTris + sideTris;

  // Binary STL: 80 byte header + 4 byte tri count + 50 bytes per triangle
  const bufferSize = 80 + 4 + totalTris * 50;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // Header (80 bytes)
  const header = 'Aral Sea Terrain STL - 220mm bed';
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
    // Compute normal
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

    view.setUint16(offset, 0, true); offset += 2; // attribute byte count
  }

  // Top surface (terrain)
  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const x0 = getX(i), x1 = getX(i + 1);
      const y0 = getY(j), y1 = getY(j + 1);
      const z00 = getZ(j, i), z10 = getZ(j, i + 1);
      const z01 = getZ(j + 1, i), z11 = getZ(j + 1, i + 1);

      writeTri(x0, y0, z00, x1, y0, z10, x0, y1, z01);
      writeTri(x1, y0, z10, x1, y1, z11, x0, y1, z01);
    }
  }

  // Bottom surface (flat at z=0)
  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const x0 = getX(i), x1 = getX(i + 1);
      const y0 = getY(j), y1 = getY(j + 1);

      writeTri(x0, y0, baseZ, x0, y1, baseZ, x1, y0, baseZ);
      writeTri(x1, y0, baseZ, x0, y1, baseZ, x1, y1, baseZ);
    }
  }

  // Side walls
  // Front edge (j=0)
  for (let i = 0; i < w - 1; i++) {
    const x0 = getX(i), x1 = getX(i + 1);
    const y = getY(0);
    writeTri(x0, y, baseZ, x1, y, baseZ, x0, y, getZ(0, i));
    writeTri(x1, y, baseZ, x1, y, getZ(0, i + 1), x0, y, getZ(0, i));
  }
  // Back edge (j=h-1)
  for (let i = 0; i < w - 1; i++) {
    const x0 = getX(i), x1 = getX(i + 1);
    const y = getY(h - 1);
    writeTri(x0, y, baseZ, x0, y, getZ(h - 1, i), x1, y, baseZ);
    writeTri(x1, y, baseZ, x0, y, getZ(h - 1, i), x1, y, getZ(h - 1, i + 1));
  }
  // Left edge (i=0)
  for (let j = 0; j < h - 1; j++) {
    const x = getX(0);
    const y0 = getY(j), y1 = getY(j + 1);
    writeTri(x, y0, baseZ, x, y0, getZ(j, 0), x, y1, baseZ);
    writeTri(x, y1, baseZ, x, y0, getZ(j, 0), x, y1, getZ(j + 1, 0));
  }
  // Right edge (i=w-1)
  for (let j = 0; j < h - 1; j++) {
    const x = getX(w - 1);
    const y0 = getY(j), y1 = getY(j + 1);
    writeTri(x, y0, baseZ, x, y1, baseZ, x, y0, getZ(j, w - 1));
    writeTri(x, y1, baseZ, x, y1, getZ(j + 1, w - 1), x, y0, getZ(j, w - 1));
  }

  return new Blob([buffer], { type: 'application/octet-stream' });
}
