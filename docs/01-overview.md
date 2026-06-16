# 1 · Project Overview

## Starting question

*What water is.* Not where, not how much, not how it flows — but what water is **imagined to be**. We call this a **comparative water-logy**: water as molecule, water as resource, water as spirit, water as infrastructure, water as play; water in the eyes of rural kids, artists, politicians, cleaners, bazar workers, farmers. The app is a place where these models can be tried on, stress-tested, and switched between.

## The map mode of water (and its limits)

The project is particularly interested in the **map mode** of water: the mode where a river is a line, a lake is a polygon, and an ecological disaster is something to be observed from above. This mode is powerful and necessary — and it carries its own limitations:

- A line makes a river feel like a pipe — it starts here, it ends there.
- But rivers leak and absorb, carve their course, are mud and silt, are mosquitos and fishermen, children swimming and willows growing.
- An ecosystem rendered as a clean external visual object hides the fact that it is neither clean nor external.

Our method is not to reject maps but to **hack them, appropriate them, test them, stress them, bend them and explore their limits**.

## Two scales

| Axis | Min | Max |
|---|---|---|
| Engagement | personal gesture | planetary system |
| Mode | serious | playful |

The app is designed to put modes that disrupt this dichotomy in the same frame: a child's gesture in front of a screen is small, but it can move a simulated sea; the sea is enormous, but in the installation it can be held, played, broken, restored, misunderstood, and reimagined.

## Goal

Turn the Aral Sea disaster from a footnote into an **experience**. A single 3D canvas — the real Khorezm / Karakalpakstan terrain — reused by ~15 modes, each telling a different slice of the story:

- **Historical** — basins of the 13th, 19th and 21st centuries, shoreline retreat 1925 → 2024.
- **Hydrological** — water flow, dams, canals, reservoirs, salinity.
- **Demographic** — child and maternal mortality, sewage coverage, schools, migration, dwellings.
- **Cultural** — vocabulary, kobyz lullabies, karavan-sarays, Aral artifacts.
- **Speculative** — Ag-MAR groundwater recharge, restoration tours, AI-driven what-if scenarios.
- **Playful** — Survive (Minecraft-like), GeoGuessr, sandbox, dust storm, Game of Life on terrain, face-tracked exploration.

## Audiences

| Audience | What they get |
|---|---|
| Curious public | Landing page with `Play` / `Explore` / `More Modes` — no jargon, no setup. |
| Students & educators | Guided tours (Narrative, Canal History, Ag-MAR) with overlay text and milestone years. |
| Researchers | Raw DEM + GeoJSON layers, downloadable STL, configurable bounds, shareable URLs. |
| Teenagers from Karakalpakstan | **Authors**, not just users — of levels, interactions, stories and scenarios. |
| Developers | A reusable R3F (`@react-three/fiber`) stack for layered geospatial visualization. |

## What the app is *not*

- Not a GIS replacement — coordinates are Plate Carrée, simplified for performance.
- Not predictive — Ag-MAR and dam simulations are illustrative, not engineering-grade.
- Not a "more correct map" — the project follows Morton in challenging the data dump, the fantasy that ecological awareness follows from more information, more graphs, more cubic kilometres, more layers.
- Not server-side — everything runs client-side except the AI scenario chat and Instagram share, which live as edge functions on Lovable Cloud.

## Visual identity

Dark scientific aesthetic — black background, glass panels with sharp non-rounded edges, monospace accents. Two contrasting "aesthetics" can be swapped at runtime:

- **Playful** — Adventure Time palette, 1.5× vertical exaggeration.
- **Serious** — muted professional palette, 0.4× exaggeration.

The toggle is itself part of the argument: the same data, the same terrain, two political imaginations. See `src/lib/visual-mode.ts`.

## Where it lives

The tool is already viral, not necessarily in scale but in its mode of spreading: from discussion to prototype, from prototype to classroom, from classroom to museum, from museum to ministry, from ministry back to children, and from children back into the platform. At the Aral School Festival it becomes a play zone with video game controllers, gesture control, televisions, projections and interactive stations where visitors can "play" Aral Sea data.
