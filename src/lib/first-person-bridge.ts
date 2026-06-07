// Shared mutable state between FirstPersonController, MapBuilderHUD and TerrainViewer.
// Avoids deep prop plumbing for the Map Builder level.

import type { PlacedItem } from './map-builder-items';

export const firstPersonBridge: {
  /** Point a small distance in front of the camera, computed each frame by FPC. */
  aim: { lat: number; lon: number } | null;
  /** Latest placed items, kept up to date by MapBuilderHUD. Used by FPC for climb-on-block collision. */
  placedItems: PlacedItem[];
} = {
  aim: null,
  placedItems: [],
};
