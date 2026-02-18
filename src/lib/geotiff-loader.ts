import { fromArrayBuffer } from 'geotiff';

export interface TerrainData {
  width: number;
  height: number;
  elevations: Float32Array | Float64Array;
  minElevation: number;
  maxElevation: number;
  noDataValue: number | null;
}

export async function loadGeoTiff(url: string): Promise<TerrainData> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const tiff = await fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();

  const width = image.getWidth();
  const height = image.getHeight();
  const rasters = await image.readRasters();
  const elevations = rasters[0] as Float32Array | Float64Array;

  // Get nodata value
  const fileDirectory = image.getFileDirectory() as unknown as Record<string, unknown>;
  const noDataValue = fileDirectory.GDAL_NODATA
    ? parseFloat(String(fileDirectory.GDAL_NODATA))
    : null;

  let minElevation = Infinity;
  let maxElevation = -Infinity;

  for (let i = 0; i < elevations.length; i++) {
    const val = elevations[i];
    if (noDataValue !== null && val === noDataValue) continue;
    if (isNaN(val)) continue;
    if (val < minElevation) minElevation = val;
    if (val > maxElevation) maxElevation = val;
  }

  return { width, height, elevations, minElevation, maxElevation, noDataValue };
}

export function getElevationColor(normalized: number): [number, number, number] {
  // Hypsometric tinting: blue → green → brown → white
  if (normalized < 0.15) {
    // Deep water to shallow
    return lerpColor([0.1, 0.2, 0.5], [0.15, 0.4, 0.6], normalized / 0.15);
  } else if (normalized < 0.35) {
    // Lowlands green
    return lerpColor([0.15, 0.4, 0.3], [0.3, 0.55, 0.2], (normalized - 0.15) / 0.2);
  } else if (normalized < 0.6) {
    // Mid elevation
    return lerpColor([0.3, 0.55, 0.2], [0.6, 0.45, 0.2], (normalized - 0.35) / 0.25);
  } else if (normalized < 0.85) {
    // High elevation brown/gray
    return lerpColor([0.6, 0.45, 0.2], [0.7, 0.65, 0.6], (normalized - 0.6) / 0.25);
  } else {
    // Peaks - snow
    return lerpColor([0.7, 0.65, 0.6], [0.95, 0.95, 0.97], (normalized - 0.85) / 0.15);
  }
}

function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  const ct = Math.max(0, Math.min(1, t));
  return [
    a[0] + (b[0] - a[0]) * ct,
    a[1] + (b[1] - a[1]) * ct,
    a[2] + (b[2] - a[2]) * ct,
  ];
}
