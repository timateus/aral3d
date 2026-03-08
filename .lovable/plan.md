

# Guided Narrative Tour for the Aral Sea

## The Story (7 Steps)

The narrative tells the story of the Aral Sea's transformation through a sequence of guided steps. Each step controls: the camera position, the timeline year, which data layers are visible, which metrics are highlighted, and displays a narration card.

### Step 1 -- "The Fourth-Largest Lake"
- **Year**: 1960 | **Camera**: High wide shot (18, 16, 18)
- **Layers**: Water extent ON, borders ON, rivers ON, basins OFF
- **Metrics**: Sea Level, Surface Area, Volume
- **Text**: "In 1960, the Aral Sea was the world's fourth-largest lake -- 68,000 km2 of water sustaining an entire region."

### Step 2 -- "The Rivers That Fed It"
- **Year**: 1960 | **Camera**: Orbit to show river inflows from the south
- **Layers**: Rivers highlighted, 13th/19th century basins ON
- **Metrics**: River Inflow
- **Text**: "The Amu Darya and Syr Darya rivers delivered ~55 km3 of water annually, following ancient basin paths carved over centuries."

### Step 3 -- "The Soviet Cotton Plan"
- **Year**: 1970 | **Camera**: Pull back to show irrigated land context
- **Layers**: Water extent ON, rivers ON
- **Metrics**: Cotton Harvest, Irrigated Area, River Inflow
- **Text**: "In the 1960s, Soviet planners diverted river water to irrigate cotton fields. By 1970, inflow had dropped dramatically."

### Step 4 -- "The Shrinking Begins"
- **Year**: 1990 | **Camera**: Zoom closer, lower angle to show exposed seabed
- **Layers**: Water extent ON, 1960 extent outline for comparison
- **Metrics**: Sea Level, Volume, Salinity
- **Text**: "By 1990, the sea had lost 60% of its volume. Salinity tripled, devastating fisheries and ecosystems."

### Step 5 -- "The Sea Splits"
- **Year**: 2005 | **Camera**: Top-down view showing the split
- **Layers**: Water extent ON, 21st century canals ON
- **Metrics**: Sea Level, Surface Area, Volume
- **Text**: "By 2005, the Aral Sea had split into separate bodies. The Eastern basin was nearly gone."

### Step 6 -- "Climate Consequences"
- **Year**: 2015 | **Camera**: Slow orbit
- **Layers**: Water extent ON
- **Metrics**: Temp Anomaly, Salinity
- **Text**: "The exposed seabed became a source of toxic dust storms. Regional temperatures shifted, rainfall patterns changed."

### Step 7 -- "The Aral Sea Today"
- **Year**: 2024 | **Camera**: Final resting position
- **Layers**: All layers ON
- **Metrics**: All key metrics
- **Text**: "Today, only fragments remain. The Northern Aral has partially recovered thanks to the Kok-Aral Dam, but the Southern basin continues to shrink. Explore freely."

## Architecture

### Data Structure

```text
// src/lib/narrative-steps.ts

interface NarrativeStep {
  id: number;
  title: string;
  text: string;
  year: number;
  camera: { position: [x, y, z], target: [x, y, z] };
  layers: {
    showBorders: boolean;
    showRivers: boolean;
    show13thBasin: boolean;
    show19thBasin: boolean;
    show21stBasin: boolean;
    showWaterExtent: boolean;
  };
  enabledSeries: string[];   // which metrics to highlight
  duration?: number;          // seconds to hold before user can advance
}
```

All 7 steps defined as a static array in this file.

### New Components

**`src/components/NarrativeOverlay.tsx`** -- The UI layer for the guided tour:
- Bottom-center narration card (glass-panel) showing title, text, and step dots
- "Next" / "Back" / "Skip Tour" buttons
- Step indicator dots (1-7)
- Fade-in/out transitions between steps

**`src/components/NarrativeCameraController.tsx`** -- A Three.js component inside the Canvas:
- Receives the target camera position/target for the current step
- Smoothly animates the camera using `useFrame` with lerp
- Disables OrbitControls during the narrative (re-enables on exit)

### State Management (in Index.tsx)

```text
const [narrativeActive, setNarrativeActive] = useState(false);
const [narrativeStep, setNarrativeStep] = useState(0);
```

When `narrativeActive` is true:
- The current step drives: `waterExtentYear`, `showBorders`, `showRivers`, `show13thBasin`, `show19thBasin`, `show21stBasin`, `showWaterExtent`, `enabledSeries`
- The timeline slider, control panel, legend, and data panel are hidden (clean cinematic view)
- The NarrativeOverlay is shown at the bottom

### Entry and Exit

**Entry points:**
1. The IntroOverlay gets a second button: "Guided Tour" alongside "Explore". Clicking it sets `narrativeActive = true` and `started = true`.
2. A small "Guided Tour" button added to the controls area (top-right) for re-entering after free exploration.

**Exit points:**
1. "Skip Tour" button on the NarrativeOverlay -- exits immediately to free exploration mode
2. Completing all 7 steps -- the final step's "Finish" button exits to free exploration
3. Pressing Escape key

On exit: `narrativeActive` is set to `false`, all UI panels reappear, OrbitControls re-enable, and the app state is left at the final step's year/layers (so the user continues from where the story ended).

### Modified Files

| File | Changes |
|---|---|
| `src/lib/narrative-steps.ts` | New file -- step definitions array |
| `src/components/NarrativeOverlay.tsx` | New file -- narration card UI |
| `src/components/NarrativeCameraController.tsx` | New file -- camera animation inside Canvas |
| `src/components/IntroOverlay.tsx` | Add "Guided Tour" button |
| `src/components/TerrainViewer.tsx` | Add NarrativeCameraController, accept narrative props, conditionally disable OrbitControls |
| `src/pages/Index.tsx` | Add narrative state, wire step changes to all layer/year/metric state, conditionally hide panels during tour |

### Camera Control During Narrative

The `OrbitControls` component receives `enabled={!narrativeActive}` so users cannot manually rotate during the tour. The `NarrativeCameraController` uses `useFrame` to smoothly lerp camera position and lookAt target over ~2 seconds per transition.

### No New Dependencies

Everything uses existing libraries: React state, Three.js camera manipulation via R3F's `useFrame`, and Tailwind + glass-panel for the overlay UI.
