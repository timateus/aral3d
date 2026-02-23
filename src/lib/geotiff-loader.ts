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

// Known bounds for GeoTIFFs that lack georeferencing metadata
const KNOWN_BOUNDS: Record<string, GeoBounds> = {
  '/data/watershed.tif': { minLon: 55.0, maxLon: 68.0, minLat: 35.0, maxLat: 48.0 },
};

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

  // Extract geographic bounds
  let bounds: GeoBounds | null = null;

  // Try getBoundingBox first (works for most well-formed GeoTIFFs)
  try {
    const bbox = image.getBoundingBox();
    if (bbox && bbox.length === 4 && (bbox[2] - bbox[0]) > 0 && (bbox[3] - bbox[1]) > 0) {
      bounds = { minLon: bbox[0], minLat: bbox[1], maxLon: bbox[2], maxLat: bbox[3] };
    }
  } catch (_) { /* no affine transformation */ }

  // Try tiepoint + pixel scale
  if (!bounds) {
    try {
      const fd = fileDirectory as any;
      const tiepoint = fd.ModelTiepoint ?? fd.actualizedFields?.ModelTiepoint;
      const pixelScale = fd.ModelPixelScale ?? fd.actualizedFields?.ModelPixelScale;
      if (tiepoint && pixelScale && pixelScale[0] > 0 && pixelScale[1] > 0) {
        bounds = {
          minLon: tiepoint[3],
          maxLon: tiepoint[3] + fullWidth * pixelScale[0],
          maxLat: tiepoint[4],
          minLat: tiepoint[4] - fullHeight * pixelScale[1],
        };
      }
    } catch (_) {}
  }

  // Try GDAL metadata for bounds
  if (!bounds) {
    try {
      const gdalMeta = (image as any).getGDALMetadata?.();
      console.log('GDAL metadata:', gdalMeta);
    } catch (_) {}
  }

  // Try to read GeoTransform from GDAL_METADATA XML
  if (!bounds) {
    try {
      const fd = fileDirectory as any;
      const metaXml = fd.GDAL_METADATA ?? fd.actualizedFields?.GDAL_METADATA;
      if (metaXml && typeof metaXml === 'string') {
        console.log('GDAL_METADATA XML:', metaXml);
      }
    } catch (_) {}
  }

  // Try origin + resolution methods
  if (!bounds) {
    try {
      const origin = image.getOrigin();
      const resolution = image.getResolution();
      if (origin && resolution) {
        bounds = {
          minLon: origin[0],
          maxLon: origin[0] + fullWidth * Math.abs(resolution[0]),
          maxLat: origin[1],
          minLat: origin[1] - fullHeight * Math.abs(resolution[1]),
        };
      }
    } catch (_) {}
  }

  // Last resort: log all raw file directory fields for debugging
  if (!bounds) {
    try {
      const fd = fileDirectory as any;
      const actualKeys = fd.actualizedFields ? Object.keys(fd.actualizedFields) : [];
      const deferredKeys = fd.deferredFields ? Object.keys(fd.deferredFields) : [];
      console.warn('No bounds found. actualizedFields:', actualKeys, 'deferredFields:', deferredKeys);
      // Try to iterate and log all actual field values
      if (fd.actualizedFields) {
        for (const key of actualKeys) {
          console.log(`  field ${key}:`, fd.actualizedFields[key]);
        }
      }
    } catch (_) {}
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
