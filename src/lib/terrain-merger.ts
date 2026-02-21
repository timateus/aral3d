import { TerrainData } from './geotiff-loader';

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
      // Map base pixel to geographic coordinate
      const lon = baseBounds.minLon + (i / (width - 1)) * (baseBounds.maxLon - baseBounds.minLon);
      const lat = baseBounds.maxLat - (j / (height - 1)) * (baseBounds.maxLat - baseBounds.minLat);

      // Check if this coordinate falls within the overlay bounds
      if (
        lon >= ovBounds.minLon && lon <= ovBounds.maxLon &&
        lat >= ovBounds.minLat && lat <= ovBounds.maxLat
      ) {
        // Map to overlay pixel
        const ovNx = (lon - ovBounds.minLon) / (ovBounds.maxLon - ovBounds.minLon);
        const ovNy = (ovBounds.maxLat - lat) / (ovBounds.maxLat - ovBounds.minLat);
        const ovX = Math.round(ovNx * (overlay.width - 1));
        const ovY = Math.round(ovNy * (overlay.height - 1));

        if (ovX >= 0 && ovX < overlay.width && ovY >= 0 && ovY < overlay.height) {
          const ovIdx = ovY * overlay.width + ovX;
          const ovVal = overlay.elevations[ovIdx];

          // Only use overlay value if it's valid (skip nodata and -9999 sentinel)
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
