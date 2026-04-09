

## Plan: Shareable URL State + Game Mode Back Button

### 1. Shareable Link via URL Search Params

**File: `src/pages/Index.tsx`**

Encode key app state into URL search parameters so users can share a link that restores a specific view. On mount, read params and apply them. On state change, update the URL (using `replaceState` to avoid polluting history).

**State to encode** (all optional params):
- `started=1` — skip intro
- `mode` — `game`, `sandbox`, `bodies`, `agmar`, `soap`, `canal`
- `year` — water extent year (1960–2020)
- `exag` — exaggeration value
- `wl` — water level
- Layers as comma-separated: `layers=rivers,borders,khorezm,waterways,schools,...`
- `waterway` — waterway filter type
- `lat,lon,zoom` — camera position (optional, future enhancement)

**Implementation:**
- Add a `useEffect` that reads `window.location.search` on mount and sets state accordingly
- Add a `useEffect` that builds search params from current state and calls `window.history.replaceState` (debounced ~500ms)
- Add a "Copy Link" button in the header toolbar

### 2. Back to Menu Button in Game Mode

**File: `src/pages/Index.tsx`**

The header with the "Menu" button is only shown when `isMapExploration` is true, which excludes game mode. Add a dedicated "← Menu" button that appears when game mode is active.

- In the game mode HUD section (around line 1266), add a "← Back to menu" button that calls `setStarted(false); setGameModeActive(false);`
- Alternatively, render a small persistent back button when `gameModeActive && started` is true, positioned top-left above the mission HUD

### Files Changed
- **`src/pages/Index.tsx`** — URL state sync logic, copy-link button, game mode back button

