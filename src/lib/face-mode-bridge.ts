// Shared toggle for Level 7 "Face as Infrastructure" mode.
// When active:
//   - TerrainViewer's SceneBackground skips painting (transparent clear)
//   - A TransparentClear helper sets renderer clear alpha to 0
//   - A FaceGestureController inside the Canvas listens to `face:gesture`
//     events emitted by FaceCameraBackground and orbits the terrain.
export const faceModeBridge: { active: boolean } = { active: false };
