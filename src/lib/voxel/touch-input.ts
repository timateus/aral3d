// Shared touch-input state for the voxel game.
// Touch overlay writes here; VoxelPlayer reads from it inside useFrame.

export interface TouchInputState {
  active: boolean;            // any touch UI is mounted
  move: { x: number; y: number };  // -1..1, y is forward (negative = up on stick)
  look: { x: number; y: number };  // pixels delta per frame (consumed each read)
  sprint: boolean;
  jumpQueued: boolean;        // edge-triggered: set true → consumed by player
  breakQueued: boolean;
  placeQueued: boolean;
}

export const touchInput: TouchInputState = {
  active: false,
  move: { x: 0, y: 0 },
  look: { x: 0, y: 0 },
  sprint: false,
  jumpQueued: false,
  breakQueued: false,
  placeQueued: false,
};

export const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' &&
  (('ontouchstart' in window) || (navigator.maxTouchPoints ?? 0) > 0);
