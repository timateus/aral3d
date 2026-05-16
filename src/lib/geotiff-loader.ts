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

  // Last resort: warn
  if (!bounds) {
    console.warn('No bounds found for', url);
  }

  console.log('Terrain loaded:', { width, height, minElevation, maxElevation, noDataValue, bounds });

  return { width, height, elevations, minElevation, maxElevation, noDataValue, bounds };
}

export function getElevationColor(normalized: number, rawElevation?: number): [number, number, number] {
  const isMirage = typeof document !== 'undefined' && document.documentElement.classList.contains('mirage');
  const elev = rawElevation !== undefined ? rawElevation : normalized * 300;
  const c = getElevationColorAbsolute(elev);
  if (!isMirage) return c;
  // Mirage: vintage atlas — keep elevation hue, soften toward warm paper.
  // Water gets a muted teal-blue tint instead of slate-only.
  if (elev < 0) {
    const t = Math.max(0, Math.min(1, (elev + 12) / 12));
    // Deep -> shallow: muted teal -> pale aqua
    return [
      0.42 + t * 0.20,
      0.62 + t * 0.12,
      0.66 + t * 0.08,
    ];
  }
  // Land: blend rich elevation color toward warm paper (~25% paper, 75% color)
  // and boost chroma slightly so vintage-atlas hues read clearly.
  const paper: [number, number, number] = [0.95, 0.92, 0.84];
  const k = 0.25;
  const mix: [number, number, number] = [
    c[0] * (1 - k) + paper[0] * k,
    c[1] * (1 - k) + paper[1] * k,
    c[2] * (1 - k) + paper[2] * k,
  ];
  const m = (mix[0] + mix[1] + mix[2]) / 3;
  const sat = 1.15;
  return [
    Math.max(0, Math.min(1, m + (mix[0] - m) * sat)),
    Math.max(0, Math.min(1, m + (mix[1] - m) * sat)),
    Math.max(0, Math.min(1, m + (mix[2] - m) * sat)),
  ];
}

function getElevationColorAbsolute(elev: number): [number, number, number] {
  // Rich color detail from -12m to 300m; compressed above 300m
  if (elev < -6) {
    // Deep below sea level – grey-green (exposed seabed)
    const t = Math.max(0, Math.min(1, (elev + 12) / 6));
    return lerpColor([0.68, 0.67, 0.6], [0.72, 0.7, 0.58], t);
  } else if (elev < 0) {
    // Shallow below sea level – pale green-tan (salt crusts)
    const t = (elev + 6) / 6;
    return lerpColor([0.72, 0.7, 0.58], [0.78, 0.74, 0.52], t);
  } else if (elev < 20) {
    // Lowest plains – pale cream-yellow
    const t = elev / 20;
    return lerpColor([0.78, 0.74, 0.52], [0.85, 0.8, 0.5], t);
  } else if (elev < 50) {
    // Low plains – warm straw yellow
    const t = (elev - 20) / 30;
    return lerpColor([0.85, 0.8, 0.5], [0.88, 0.78, 0.42], t);
  } else if (elev < 80) {
    // Low-mid – golden yellow
    const t = (elev - 50) / 30;
    return lerpColor([0.88, 0.78, 0.42], [0.84, 0.72, 0.36], t);
  } else if (elev < 120) {
    // Mid-low – warm ochre
    const t = (elev - 80) / 40;
    return lerpColor([0.84, 0.72, 0.36], [0.78, 0.62, 0.32], t);
  } else if (elev < 160) {
    // Mid – amber-brown
    const t = (elev - 120) / 40;
    return lerpColor([0.78, 0.62, 0.32], [0.72, 0.55, 0.28], t);
  } else if (elev < 200) {
    // Upper-mid – rich brown
    const t = (elev - 160) / 40;
    return lerpColor([0.72, 0.55, 0.28], [0.65, 0.48, 0.28], t);
  } else if (elev < 250) {
    // Transition – warm sienna
    const t = (elev - 200) / 50;
    return lerpColor([0.65, 0.48, 0.28], [0.6, 0.44, 0.3], t);
  } else if (elev < 300) {
    // Upper transition – dusty brown
    const t = (elev - 250) / 50;
    return lerpColor([0.6, 0.44, 0.3], [0.56, 0.42, 0.32], t);
  } else if (elev < 1000) {
    // Mountains – compressed brown to grey
    const t = (elev - 300) / 700;
    return lerpColor([0.56, 0.42, 0.32], [0.55, 0.52, 0.5], t);
  } else if (elev < 3000) {
    // High mountains – slate
    const t = (elev - 1000) / 2000;
    return lerpColor([0.55, 0.52, 0.5], [0.65, 0.63, 0.65], t);
  } else {
    // Peaks – snow
    const t = Math.min(1, (elev - 3000) / 2000);
    return lerpColor([0.65, 0.63, 0.65], [0.95, 0.95, 0.97], t);
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
