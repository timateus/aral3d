# 1 · Project Overview

Aral in 3D is a single 3D canvas — the real Khorezm / Karakalpakstan terrain — used in **two modes**.

## Game mode

A sequence of short, focused **levels**. Each level is an educational micro-experience: one mechanic, one slice of the Aral story, a few minutes long. Levels can be played in order or jumped into directly.

Goals of the game mode:

- Make the Aral Sea history graspable through doing rather than reading.
- Give teachers a set of ready-made interactive lessons (water level, slope and flow, location recognition, on-the-ground walks).
- Give students something they actually want to play.

See [02-modes-and-levels.md](02-modes-and-levels.md#game-levels) for the level list.

## Explore mode

A GIS-like data exploration tool over the same terrain. Real DEM data, historical shorelines from 1925 to 2024, demographic layers, climate records, vector overlays, contours, basemaps, region bounds.

Goals of the explore mode:

- Let researchers, journalists and curious users inspect the raw data behind the story.
- Allow any view to be shared as a URL (state is encoded in search params).
- Provide a baseline that the game levels build on top of — same terrain, same coordinate system, same data layers.

See [02-modes-and-levels.md](02-modes-and-levels.md#explore-mode) for the panel-by-panel reference.

## Audiences

| Audience | Likely entry point |
|---|---|
| Students, schools, museums | Game mode |
| Researchers, journalists, policymakers | Explore mode |
| Casual visitors | Either — landing page offers both |
| Developers | Explore mode + the docs in this folder |

## Why two modes and not more

Earlier iterations had many parallel modes. They have been folded into these two: anything playful and goal-driven is a **game level**; anything analytical and open-ended belongs in **explore**. This keeps the product legible to first-time visitors and keeps the codebase focused.

## What the app is *not*

- Not a GIS replacement — coordinates are Plate Carrée, simplified for performance.
- Not predictive — simulations are illustrative, not engineering-grade.
- Not server-side — everything runs client-side except a few edge functions on Lovable Cloud (AI scenario chat, share).

## Philosophy

The framing behind the project — why a data tool is also a game, and what "playing with models of water" means — lives in [philosophy.md](philosophy.md). It is background reading, not required to use or build the app.
