

## Fix: Waterways Layer Not Visible

### Root Cause
Line 283 in `WaterwaysLayer.tsx` creates `new LineSegments2(fatLines.geo, fatLines.mat)` **inline inside JSX** on every render. This means:
1. A new Three.js object is created each render cycle
2. The old object is orphaned (not properly disposed)
3. R3F's reconciler struggles with `primitive` objects that change identity every frame

### Solution
Memoize the `LineSegments2` instance so it has a stable identity, and update it only when the geometry/material actually change. Also dispose old instances properly.

### Changes

**File: `src/components/WaterwaysLayer.tsx`**

1. Combine the `fatLines` memo to return a fully constructed `LineSegments2` object instead of separate `{ geo, mat }`:
   - Create the `LineSegments2` inside the `useMemo` that builds `fatLines`
   - Return the object directly so it has a stable reference

2. Change the render from:
   ```tsx
   <primitive object={new LineSegments2(fatLines.geo, fatLines.mat)} />
   ```
   to:
   ```tsx
   <primitive object={fatLinesObject} />
   ```
   where `fatLinesObject` is the memoized `LineSegments2` instance.

3. Add cleanup via `useEffect` to dispose the old geometry/material when they change.

This is a single-file fix in `WaterwaysLayer.tsx` — no other files need changes.

