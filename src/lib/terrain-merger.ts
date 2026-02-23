import { TerrainData, GeoBounds } from './geotiff-loader';

/**
 * Merge two terrain datasets. The overlay replaces the base where it has valid data
 * within the overlapping geographic region.
 */
export function mergeTerrains(base: TerrainData, overlay: TerrainData): TerrainData {
  if (!base.bounds || !overlay.bounds) {
    console.warn('Cannot merge terrains without geographic bounds, returning base');
    return base;
  }

  const { width, height } = base;
  const merged = new Float32Array(width * height);
  merged.set(base.elevations);

  const baseBounds = base.bounds;
  const ovBounds = overlay.bounds;

  let minElev = base.minElevation;
  let maxElev = base.maxElevation;

  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const lon = baseBounds.minLon + (i / (width - 1)) * (baseBounds.maxLon - baseBounds.minLon);
      const lat = baseBounds.maxLat - (j / (height - 1)) * (baseBounds.maxLat - baseBounds.minLat);

      if (
        lon >= ovBounds.minLon && lon <= ovBounds.maxLon &&
        lat >= ovBounds.minLat && lat <= ovBounds.maxLat
      ) {
        const ovNx = (lon - ovBounds.minLon) / (ovBounds.maxLon - ovBounds.minLon);
        const ovNy = (ovBounds.maxLat - lat) / (ovBounds.maxLat - ovBounds.minLat);
        const ovX = Math.round(ovNx * (overlay.width - 1));
        const ovY = Math.round(ovNy * (overlay.height - 1));

        if (ovX >= 0 && ovX < overlay.width && ovY >= 0 && ovY < overlay.height) {
          const ovIdx = ovY * overlay.width + ovX;
          const ovVal = overlay.elevations[ovIdx];

          const isNoData =
            (overlay.noDataValue !== null && ovVal === overlay.noDataValue) ||
            isNaN(ovVal) ||
            ovVal <= -9999;
          if (!isNoData) {
            const baseIdx = j * width + i;
            merged[baseIdx] = ovVal;
            if (ovVal < minElev) minElev = ovVal;
            if (ovVal > maxElev) maxElev = ovVal;
          }
        }
      }
    }
  }

  return {
    width,
    height,
    elevations: merged,
    minElevation: minElev,
    maxElevation: maxElev,
    noDataValue: base.noDataValue,
    bounds: base.bounds,
  };
}

/**
 * Merge two terrain datasets, expanding the output grid to encompass both.
 * The overlay is placed on top of the base where it has valid data.
 * Areas outside the base but inside the overlay are filled with overlay data.
 * Areas outside both are filled with the base min elevation.
 */
export function mergeExpandTerrains(base: TerrainData, overlay: TerrainData, fillNoData = true): TerrainData {
  if (!base.bounds || !overlay.bounds) {
    console.warn('Cannot merge terrains without geographic bounds, returning base');
    return base;
  }

  const baseBounds = base.bounds;
  const ovBounds = overlay.bounds;

  // Compute the union bounding box
  const unionBounds: GeoBounds = {
    minLon: Math.min(baseBounds.minLon, ovBounds.minLon),
    maxLon: Math.max(baseBounds.maxLon, ovBounds.maxLon),
    minLat: Math.min(baseBounds.minLat, ovBounds.minLat),
    maxLat: Math.max(baseBounds.maxLat, ovBounds.maxLat),
  };

  // Compute output resolution: use the base's pixel density
  const baseLonPerPx = (baseBounds.maxLon - baseBounds.minLon) / (base.width - 1);
  const baseLatPerPx = (baseBounds.maxLat - baseBounds.minLat) / (base.height - 1);

  const outWidth = Math.round((unionBounds.maxLon - unionBounds.minLon) / baseLonPerPx) + 1;
  const outHeight = Math.round((unionBounds.maxLat - unionBounds.minLat) / baseLatPerPx) + 1;

  // Cap at reasonable size
  const maxDim = 600;
  const finalWidth = Math.min(outWidth, maxDim);
  const finalHeight = Math.min(outHeight, maxDim);

  const merged = new Float32Array(finalWidth * finalHeight);
  let minElev = Infinity;
  let maxElev = -Infinity;

  for (let j = 0; j < finalHeight; j++) {
    for (let i = 0; i < finalWidth; i++) {
      const lon = unionBounds.minLon + (i / (finalWidth - 1)) * (unionBounds.maxLon - unionBounds.minLon);
      const lat = unionBounds.maxLat - (j / (finalHeight - 1)) * (unionBounds.maxLat - unionBounds.minLat);

      let value = base.minElevation; // default fill
      let filled = false;

      // Sample from base
      const inBase =
        lon >= baseBounds.minLon && lon <= baseBounds.maxLon &&
        lat >= baseBounds.minLat && lat <= baseBounds.maxLat;

      if (inBase) {
        const bNx = (lon - baseBounds.minLon) / (baseBounds.maxLon - baseBounds.minLon);
        const bNy = (baseBounds.maxLat - lat) / (baseBounds.maxLat - baseBounds.minLat);
        const bX = Math.round(bNx * (base.width - 1));
        const bY = Math.round(bNy * (base.height - 1));
        if (bX >= 0 && bX < base.width && bY >= 0 && bY < base.height) {
          const bVal = base.elevations[bY * base.width + bX];
          const isNoData =
            (base.noDataValue !== null && bVal === base.noDataValue) ||
            isNaN(bVal) || bVal <= -9999;
          if (!isNoData) {
            value = bVal;
            filled = true;
          }
        }
      }

      // Sample from overlay (overwrites base)
      const inOverlay =
        lon >= ovBounds.minLon && lon <= ovBounds.maxLon &&
        lat >= ovBounds.minLat && lat <= ovBounds.maxLat;

      if (inOverlay) {
        const oNx = (lon - ovBounds.minLon) / (ovBounds.maxLon - ovBounds.minLon);
        const oNy = (ovBounds.maxLat - lat) / (ovBounds.maxLat - ovBounds.minLat);
        const oX = Math.round(oNx * (overlay.width - 1));
        const oY = Math.round(oNy * (overlay.height - 1));
        if (oX >= 0 && oX < overlay.width && oY >= 0 && oY < overlay.height) {
          const oVal = overlay.elevations[oY * overlay.width + oX];
          const isNoData =
            (overlay.noDataValue !== null && oVal === overlay.noDataValue) ||
            isNaN(oVal) || oVal <= -9999;
          if (!isNoData) {
            value = oVal;
            filled = true;
          }
        }
      }

      if (!filled) {
        value = base.minElevation;
      }

      merged[j * finalWidth + i] = value;
      if (value < minElev) minElev = value;
      if (value > maxElev) maxElev = value;
    }
  }

  console.log('Expanded merge:', { finalWidth, finalHeight, unionBounds, minElev, maxElev });

  return {
    width: finalWidth,
    height: finalHeight,
    elevations: merged,
    minElevation: minElev,
    maxElevation: maxElev,
    noDataValue: base.noDataValue,
    bounds: unionBounds,
  };
}
