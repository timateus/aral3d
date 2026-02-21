

# Scenario Simulation Chatbot for Aral Sea Terrain Viewer

## Overview

Add an AI-powered chatbot panel that interprets natural language commands (e.g., "draw forests around canals", "build a dam near Nukus") and renders the results as 3D overlays on the terrain. The AI parses commands into structured actions, and the viewer renders them as visual scenario elements.

## Architecture

The system has three layers:

1. **Chat UI** -- A collapsible panel on the left side of the screen where the user types scenario commands and sees responses
2. **AI Backend** -- A Lovable Cloud edge function that calls Lovable AI (Gemini) with a system prompt containing terrain context (bounds, cities, rivers, canals). It uses tool-calling to return structured scenario actions
3. **Scenario Overlay Renderer** -- A Three.js component that renders the AI-parsed actions as 3D objects on the terrain (forest patches, dam structures, water level changes, etc.)

```text
User Input --> Chat UI --> Edge Function --> Lovable AI (Gemini)
                                                  |
                                          tool_call response
                                                  |
                                     structured scenario actions
                                                  |
                                     ScenarioOverlay component
                                          renders on terrain
```

## Prerequisites

- **Enable Lovable Cloud** -- needed for the edge function
- **Lovable AI** is auto-provisioned with `LOVABLE_API_KEY`

## Supported Scenario Actions

The AI will return structured actions via tool-calling. Initial action types:

| Action Type | Parameters | Visual |
|---|---|---|
| `forest` | center lat/lon, radius (km), density | Green tree-like 3D meshes scattered on terrain |
| `dam` | lat/lon, width, height | Gray box/wall across a river path |
| `water_level` | value (meters) | Updates the existing water level slider |
| `canal` | start lat/lon, end lat/lon, width | Blue line on terrain surface |
| `settlement` | lat/lon, name, size | Small cluster of box meshes |
| `label` | lat/lon, text | Floating text label |

## Implementation Steps

### Step 1: Enable Lovable Cloud

Required to host the edge function that calls Lovable AI.

### Step 2: Create the Edge Function (`supabase/functions/scenario-chat/index.ts`)

- Accepts `{ messages }` from the frontend
- System prompt includes geographic context: terrain bounds, city coordinates, river/canal names and approximate locations, current water level
- Uses Lovable AI with **tool-calling** to extract structured scenario actions
- Defines a `apply_scenario` tool with the schema for all action types
- Returns the AI's text response + parsed scenario actions as JSON

### Step 3: Create the Chat UI Component (`src/components/ScenarioChat.tsx`)

- Collapsible panel on the left side, toggled by a chat icon button
- Simple message list with user/assistant messages
- Input field at the bottom
- Renders AI responses with markdown support
- Extracts scenario actions from the AI response and passes them up to the parent

### Step 4: Create the Scenario Overlay Component (`src/components/ScenarioOverlay.tsx`)

- Receives an array of scenario actions
- For each action type, renders appropriate 3D geometry on the terrain:
  - **Forests**: Instanced cone/cylinder meshes (simplified trees) scattered within a radius, positioned on terrain surface
  - **Dams**: Box geometry positioned and oriented across the terrain
  - **Canals**: Line geometry similar to existing river rendering
  - **Settlements**: Small box clusters
  - **Labels**: Html labels similar to existing city markers
- Uses the same `geoToMeshPos` coordinate conversion as existing components
- Water level changes update the parent state directly

### Step 5: Wire Everything Together in Index.tsx

- Add `scenarioActions` state array
- Add `showChat` toggle state
- Render `ScenarioChat` panel (conditionally)
- Pass scenario actions to `ScenarioOverlay` inside the Canvas
- When AI returns a `water_level` action, update the `waterLevel` state

## Technical Details

### Edge Function System Prompt (key context provided to AI)

The system prompt will include:
- The terrain's geographic bounds (lat/lon extents)
- List of cities with coordinates (Nukus, Moynaq, Aral, etc.)
- Major rivers (Amu Darya) and their approximate path
- Known canal names from the GeoJSON data
- Current water level
- Instructions to place features using real lat/lon coordinates within the bounds

### Tool-Calling Schema

```text
Tool: apply_scenario
Parameters:
  actions: array of objects, each with:
    - type: "forest" | "dam" | "water_level" | "canal" | "settlement" | "label"
    - lat, lon (center point)
    - radius (for forests, in km)
    - width, height (for dams)
    - start/end coordinates (for canals)
    - value (for water_level)
    - name/text (for labels/settlements)
```

### 3D Rendering Approach

- **Forests**: Use `InstancedMesh` with cone geometry for performance. Scatter ~50-200 instances within the specified radius, each positioned on the terrain surface using elevation lookup.
- **Dams**: Simple `BoxGeometry` scaled and rotated to span across the terrain at the specified location.
- **Canals**: Reuse the `Line` component pattern from `GeoFeatures.tsx`.

### Chat UI Design

- Glass-panel styling matching existing controls
- Max width ~320px, full height on the left side
- Scrollable message area
- Messages styled with role-based colors (user = white, assistant = primary blue)
- "Clear scenario" button to reset all overlays

## New Files

1. `supabase/functions/scenario-chat/index.ts` -- AI edge function
2. `src/components/ScenarioChat.tsx` -- Chat panel UI
3. `src/components/ScenarioOverlay.tsx` -- 3D scenario renderer
4. `src/types/scenario.ts` -- Shared type definitions for scenario actions

## Modified Files

1. `src/pages/Index.tsx` -- Add chat toggle, scenario state, wire components
2. `supabase/config.toml` -- Register the edge function

