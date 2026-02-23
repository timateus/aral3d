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
    if (isNaN(val) || val <= -9999) continue;
    if (val < minElevation) minElevation = val;
    if (val > maxElevation) maxElevation = val;
  }

  // Extract geographic bounds from image bbox or tiepoint + pixel scale
  let bounds: GeoBounds | null = null;

  // Debug: log all file directory keys for troubleshooting
  console.log('GeoTIFF fileDirectory keys:', Object.keys(fileDirectory));
  console.log('GeoTIFF ModelTiepoint:', (fileDirectory as any).ModelTiepoint);
  console.log('GeoTIFF ModelPixelScale:', (fileDirectory as any).ModelPixelScale);
  console.log('GeoTIFF ModelTransformation:', (fileDirectory as any).ModelTransformation);
  
  try {
    const bbox = image.getBoundingBox();
    console.log('GeoTIFF getBoundingBox:', bbox);
    if (bbox && bbox.length === 4 && (bbox[2] - bbox[0]) > 0 && (bbox[3] - bbox[1]) > 0) {
      bounds = {
        minLon: bbox[0],
        minLat: bbox[1],
        maxLon: bbox[2],
        maxLat: bbox[3],
      };
    }
  } catch (e) {
    console.warn('getBoundingBox failed:', e);
  }

  // Try tiepoint + pixel scale if bbox didn't work
  if (!bounds) {
    try {
      const tiepoint = (fileDirectory as any).ModelTiepoint;
      const pixelScale = (fileDirectory as any).ModelPixelScale;
      if (tiepoint && pixelScale && pixelScale[0] > 0 && pixelScale[1] > 0) {
        bounds = {
          minLon: tiepoint[3],
          maxLon: tiepoint[3] + fullWidth * pixelScale[0],
          maxLat: tiepoint[4],
          minLat: tiepoint[4] - fullHeight * pixelScale[1],
        };
      }
    } catch (e2) {
      console.warn('Tiepoint extraction failed:', e2);
    }
  }

  // Try ModelTransformation matrix as last resort
  if (!bounds) {
    try {
      const transform = (fileDirectory as any).ModelTransformation;
      if (transform && transform.length >= 8) {
        // Affine transformation: [sx, 0, 0, tx, 0, sy, 0, ty, ...]
        const sx = transform[0];
        const ty = transform[3];
        const sy = transform[5];
        const tx = transform[7];
        if (sx !== 0 && sy !== 0) {
          bounds = {
            minLon: Math.min(ty, ty + fullWidth * sx),
            maxLon: Math.max(ty, ty + fullWidth * sx),
            maxLat: Math.max(tx, tx + fullHeight * sy),
            minLat: Math.min(tx, tx + fullHeight * sy),
          };
          console.log('Bounds from ModelTransformation:', bounds);
        }
      }
    } catch (e3) {
      console.warn('ModelTransformation extraction failed:', e3);
    }
  }

  console.log('Terrain loaded:', { width, height, minElevation, maxElevation, noDataValue, bounds });

  return { width, height, elevations, minElevation, maxElevation, noDataValue, bounds };
}

export function getElevationColor(normalized: number): [number, number, number] {
  // Land-only hypsometric tinting: green → brown → white (no blue)
  if (normalized < 0.25) {
    // Lowlands green
    return lerpColor([0.15, 0.4, 0.3], [0.3, 0.55, 0.2], normalized / 0.25);
  } else if (normalized < 0.5) {
    // Mid elevation
    return lerpColor([0.3, 0.55, 0.2], [0.6, 0.45, 0.2], (normalized - 0.25) / 0.25);
  } else if (normalized < 0.75) {
    // High elevation brown/gray
    return lerpColor([0.6, 0.45, 0.2], [0.7, 0.65, 0.6], (normalized - 0.5) / 0.25);
  } else {
    // Peaks - snow
    return lerpColor([0.7, 0.65, 0.6], [0.95, 0.95, 0.97], (normalized - 0.75) / 0.25);
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
