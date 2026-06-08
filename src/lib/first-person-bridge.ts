// Shared mutable state between FirstPersonController, MapBuilderHUD and TerrainViewer.
// Avoids deep prop plumbing for the map-builder / school levels.

import type { PlacedItem } from './map-builder-items';

export const firstPersonBridge: {
  /** Point a small distance in front of the camera, computed each frame by FPC. */
  aim: { lat: number; lon: number } | null;
  /** Latest placed items, kept up to date by HUD. Used by FPC for climb-on-block collision. */
  placedItems: PlacedItem[];
  /** Player geographic position for guided overlays. */
  player: { lat: number; lon: number } | null;
  /** School-level guidance state shared between HUD and controller. */
  school: {
    active: boolean;
    autoWalk: boolean;
    arrived: boolean;
    dialogOpen: boolean;
    target: { lat: number; lon: number } | null;
  };
} = {
  aim: null,
  placedItems: [],
  player: null,
  school: {
    active: false,
    autoWalk: false,
    arrived: false,
    dialogOpen: false,
    target: null,
  },
};
