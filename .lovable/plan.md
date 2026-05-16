# Color in Mirage + Toolbar Order

## 1. Restore color to the mirage surface

**Classic DEM mode** (`src/lib/geotiff-loader.ts` → `getElevationColor`)
The current mirage branch maps land to a warm-paper grayscale ramp and water to slate-blue, killing all elevation hue. Replace it with a desaturated-but-tinted version of the full elevation palette:

- Get the rich color from `getElevationColorAbsolute(elev)` as today.
- Blend toward a warm paper base by ~55% (not 100%) so straw / ochre / sienna / sea-blue all stay visible, just softened.
- Keep water (elev < 0) tinted toward muted teal-blue instead of slate-only.

This preserves the "paper map" feel but yields a colored map similar to a vintage atlas instead of a flat gray.

**Satellite mode** (`src/components/MapboxTerrainMesh.tsx` fragment shader)
The shader currently force-mixes sepia at 0.7 in mirage. Change to a mild desaturation (mix toward luminance at ~0.35) with a slight warm tint, so the satellite colors of land/water remain readable in mirage.

## 2. Bring order to the top toolbar

Current layout (`src/pages/Index.tsx` ~lines 1483–1625) is one wide `flex-wrap` row at `top-4` containing 9+ buttons plus a title. It wraps into a second line that collides with the `top-16` contour/vector subrow and with the DataPanel mounted at `top-16 left-4`.

Reorganize into three stable clusters on a single row:

```text
[ Menu | Mirage ]   [ Surface | Contours | Vectors ]   [ Life | Game ]            <title>            [ Copy | Record | ⋯ More ]
   left group              center group (style)            actions group       (hidden < lg)                right group
```

Concrete changes in `src/pages/Index.tsx`:

- Split the single wrapping row into three sibling flex groups inside one bar: left (Menu, Mirage, Hide panel), center (terrain-style segmented + Life + Game Mode), right (Copy Link, Record, More).
- Move low-frequency buttons (Hide/Show panel, Copy Link, Record, Game Mode when not active) behind a small `⋯ More` dropdown using the existing `popover` ui component so the bar fits on one line at typical viewports.
- Drop the inline `<h1>` title + filename on screens narrower than `lg` (`hidden lg:flex`) — they're the main reason the bar wraps today.
- Reserve a fixed header height (`h-12`) on the top bar wrapper and shift dependent overlays down accordingly:
  - DataPanel wrapper: `top-16` → `top-[4.5rem]` and constrain `max-height` so it scrolls instead of pushing.
  - Terrain-style subrow (`top-16`): only render when `terrainStyle !== 'none'`, and move it to `top-[3.25rem]` with its own `h-9` so it sits flush under the bar without colliding.
- Add `z` ordering: main bar `z-30`, subrow `z-20`, DataPanel `z-10` so a momentary overflow never hides controls.

No new components, no behavior changes — only layout grouping, a More dropdown using existing shadcn `DropdownMenu`, and coordinate adjustments.

## Out of scope

- No changes to game/walk/soap/dust HUDs (those are conditional and not part of the overlap report).
- No changes to the right-side Legend/ControlPanel column.
