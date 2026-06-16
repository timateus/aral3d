# 1 · Project Overview

## Goal

Turn the Aral Sea disaster from a footnote into an experience. The app gives a single 3D canvas — the real Khorezm / Karakalpakstan terrain — that is reused by ~15 modes, each one telling a different slice of the story:

- **Historical** — basins of the 13th, 19th and 21st centuries, year-by-year shoreline retreat 1925 → 2024.
- **Hydrological** — water flow, dams, canals, reservoirs, salinity.
- **Demographic** — child mortality, maternal mortality, sewage coverage, schools, migration, dwelling materials.
- **Cultural** — vocabulary, music (kobyz lullabies), karavan-sarays, Aral artifacts.
- **Speculative** — Ag-MAR groundwater recharge, restoration tours, AI-driven what-if scenarios.
- **Playful** — Survive (Minecraft-like), GeoGuessr, sandbox simulation, dust storm, Game of Life on terrain, face-tracked exploration.

## Audience

| Audience | What they get |
|---|---|
| Curious public | A landing page with `Play` / `Explore` / `More Modes` — no jargon, no setup. |
| Students & educators | Guided tours (Narrative, Canal History, Ag-MAR) with overlay text and milestone years. |
| Researchers | Raw DEM + GeoJSON layers, downloadable STL of the terrain, configurable bounds, shareable URLs. |
| Developers | A reusable R3F (`@react-three/fiber`) stack for layered geospatial visualization. |

## What the app is *not*

- Not a GIS replacement — coordinates are Plate Carrée, simplified for performance.
- Not predictive — Ag-MAR and dam simulations are illustrative, not engineering-grade.
- Not server-side — everything runs client-side except the AI scenario chat and Instagram share, which live as edge functions on Lovable Cloud.

## Visual identity

Dark scientific aesthetic — black background, glass panels with sharp non-rounded edges, monospace accents. Two contrasting "aesthetics" can be swapped at runtime:

- **Playful** — Adventure Time palette, 1.5× vertical exaggeration.
- **Serious** — muted professional palette, 0.4× exaggeration.

See `mem://style/aesthetic` and `src/lib/visual-mode.ts`.
