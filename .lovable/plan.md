

## Ag-MAR Presentation Tour

### Overview
Add a 5th card ("Learn") to the landing page that launches a narrated tour through the 7 slides of the Ag-MAR presentation, using the same narrative overlay pattern as the existing guided tour. The final step adds proposal site markers for Karauzyak and Taxtakupir.

### Presentation Content (7 steps)

| Step | Title | Camera Focus | Key Content |
|------|-------|-------------|-------------|
| 1 | Implementing Ag-MAR in Karakalpakstan | Overview of region | Title slide — sustainable water management intro |
| 2 | The Challenge — Why Now? | Lower Amu Darya | Water scarcity, soil degradation, climate change |
| 3 | The Mechanics | Zoom to farmland area | Infiltration basins, groundwater recharge, desalination |
| 4 | Ag-MAR: How It Works | Canal systems | Winter flow banking, IoT monitoring, soil desalination |
| 5 | Core Questions | Karauzyak/Taxtakupir area | Scale, stakeholders, mungbean irrigation |
| 6 | Steps of Implementation | Region overview | Site selection, infrastructure, monitoring |
| 7 | Proposal Sites | Zoom to markers | Karauzyak (~42.1°N, 58.7°E) and Taxtakupir (~42.5°N, 59.0°E) with pulsing markers |

### Files to Create/Edit

1. **`src/lib/agmar-tour-steps.ts`** — New file defining `AgmarTourStep[]` with title, text, camera positions, and layer configs for each of the 7 slides. Last step includes `proposalSites` array with coordinates for Karauzyak and Taxtakupir.

2. **`src/components/AgmarTourOverlay.tsx`** — New overlay component (modeled on `NarrativeOverlay`). Shows slide title, narration text, step dots, and prev/next navigation. On the last step, renders proposal site labels. Includes slide-specific images copied from the parsed PPTX.

3. **`src/components/IntroOverlay.tsx`** — Add a 5th card "Learn" to the landing grid (change from 2x2 to a layout accommodating 5 cards). The card says "Ag-MAR Technology — A proposal for sustainable water management". Clicking calls a new `onAgmarTour` prop.

4. **`src/pages/Index.tsx`** — Add state (`agmarTourActive`, `agmarTourStep`), handlers (`startAgmarTour`, `handleAgmarTourStepChange`, `exitAgmarTour`), pass camera positions to TerrainViewer when active, render `AgmarTourOverlay`, and pass `onAgmarTour` to IntroOverlay.

5. **Copy slide images** — Copy key slide screenshots from the parsed document into `public/images/agmar/` for use in the overlay panels.

### Landing Page Layout
Change the 2x2 grid to accommodate 5 cards. Top row: 3 cards (Play, Touch, Learn). Bottom row: 2 cards (Walk, Explore). The new "Learn" card uses a green/emerald accent.

### Proposal Sites (Final Slide)
The last tour step will show two pulsing markers on the 3D map at Karauzyak and Taxtakupir coordinates, rendered as `Html` overlays in the TerrainViewer (similar to vocabulary layer markers). These appear only when the Ag-MAR tour is on the final step.

