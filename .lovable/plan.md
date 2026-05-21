## Plan

Fix the layer toggle “restart” at the source: the 3D canvas currently stays mounted, but adding certain layers can still rebuild the terrain object and/or re-run the intro camera logic, which looks like Explore mode restarting.

### Changes to make

1. **Make the intro camera animation run only once per app session**
   - Replace the local `CameraAnimator` mount-only `hasStarted` state with a module-level/session guard.
   - When Explore is already started from the URL or after the first start, toggling layers/remounting scene children will not replay the intro flight.

2. **Preserve camera + orbit target across layer/terrain updates**
   - Store the latest camera position and `OrbitControls` target in refs outside the animated camera component.
   - When the scene re-renders because a layer is added, restore the current view instead of resetting to `[0,18,8]` / intro target.

3. **Cache merged terrain outputs, not just raw GeoTIFFs**
   - Add a small memo/cache around `mergeTerrains` and `mergeExpandTerrains` results in `Index.tsx` or `terrain-merger.ts`.
   - This prevents toggles like Khorezm/watershed/terrain-extension from constructing a brand-new terrain object unnecessarily and forcing expensive geometry rebuilds.

4. **Keep heavy overlay loading from blanking the map**
   - Ensure data overlays mount independently and use existing cached data where available.
   - Do not clear parent terrain state when overlays load or fail.

5. **Verify with the actual bug path**
   - Test starting Explore, moving the camera, toggling several layers (`rivers`, `water extent`, `21st basin`, `landcover`, `Khorezm/watershed`), and confirm the camera does not jump or replay the intro.

### Technical notes

- Primary files to edit: `src/components/TerrainViewer.tsx`, `src/pages/Index.tsx`, and possibly `src/lib/terrain-merger.ts`.
- The previous GeoTIFF cache helped with re-fetching, but this issue appears to be camera/scene reinitialization plus merged-terrain object churn, not just raw DEM loading.