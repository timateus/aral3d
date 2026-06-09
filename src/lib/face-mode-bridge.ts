// Shared toggle for Level 7 "Face as Infrastructure" mode.
// When active:
//   - TerrainViewer's SceneBackground skips painting (transparent clear)
//   - A TransparentClear helper sets renderer clear alpha to 0
//   - FaceGestureController polls `faceModeBridge.intent` every frame
//     so palm/zoom gestures produce smooth, CONTINUOUS motion (the raw
//     MediaPipe result frames only fire ~15Hz, which felt stuck).
export const faceModeBridge: {
  active: boolean;
  intent: {
    // per-second rates; FaceGestureController multiplies by frame delta.
    azimuthRate: number; // radians/sec
    polarRate: number;   // radians/sec
    zoomRate: number;    // units/sec
  };
} = {
  active: false,
  intent: { azimuthRate: 0, polarRate: 0, zoomRate: 0 },
};
