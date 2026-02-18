import { fromArrayBuffer } from 'geotiff';

export interface GeoBounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

export interface TerrainData {
  width: number;
  height: number;
  elevations: Float32Array | Float64Array;
  minElevation: number;
  maxElevation: number;
  noDataValue: number | null;
  bounds: GeoBounds | null;
}

export async function loadGeoTiff(url: string): Promise<TerrainData> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const tiff = await fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();

  const fullWidth = image.getWidth();
  const fullHeight = image.getHeight();

  // Downsample large images during read to avoid memory issues
  const maxDim = 512;
  const scaleX = Math.max(1, Math.ceil(fullWidth / maxDim));
  const scaleY = Math.max(1, Math.ceil(fullHeight / maxDim));
  const width = Math.floor(fullWidth / scaleX);
  const height = Math.floor(fullHeight / scaleY);

  const rasters = await image.readRasters({
    width,
    height,
    resampleMethod: 'nearest',
  });
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

  // Extract geographic bounds from tiepoint + pixel scale
  let bounds: GeoBounds | null = null;
  try {
    const tiepoint = fileDirectory.ModelTiepoint as number[] | undefined;
    const pixelScale = fileDirectory.ModelPixelScale as number[] | undefined;
    if (tiepoint && pixelScale) {
      const originX = tiepoint[3]; // lon of top-left
      const originY = tiepoint[4]; // lat of top-left
      const scaleXGeo = pixelScale[0];
      const scaleYGeo = pixelScale[1];
      bounds = {
        minLon: originX,
        maxLon: originX + fullWidth * scaleXGeo,
        maxLat: originY,
        minLat: originY - fullHeight * scaleYGeo,
      };
    }
  } catch (e) {
    console.warn('Could not extract geo bounds:', e);
  }

  console.log('Terrain loaded:', { width, height, minElevation, maxElevation, noDataValue, bounds });

  return { width, height, elevations, minElevation, maxElevation, noDataValue, bounds };
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
