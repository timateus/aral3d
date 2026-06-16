# Aral in 3D — Documentation

**Live site:** https://aral3d.com  
**Preview:** https://aral3d.lovable.app

An interactive, multi-modal 3D exploration of the Aral Sea region — built to make the slow, century-long story of the world's most famous environmental catastrophe legible to anyone with a browser. Real DEM (digital elevation) data, satellite imagery, historical basin shapes, demographic and climate records, and a stack of mini-games and simulations are layered on top of the same terrain.

![Landing page](screenshots/01-landing.png)

## Why this exists

The Aral Sea collapsed not because of one catastrophic event but because of decades of irrigation policy, climate change, and population pressure. Numbers in a UN report don't convey that. A 3D terrain you can:

- scrub through time (1925 → 2024),
- fly over,
- drain and refill,
- guess locations on,
- and even **survive in** Minecraft-style,

…does. The project is part atlas, part toy, part argument.

## Documentation map

| File | Audience | What's inside |
|---|---|---|
| [01-overview.md](01-overview.md) | Everyone | Goals, audience, what the app does at a high level |
| [02-modes-and-levels.md](02-modes-and-levels.md) | Players / educators | Walk-through of every game mode and level |
| [03-architecture.md](03-architecture.md) | Developers | Tech stack, render pipeline, data flow |
| [04-data-sources.md](04-data-sources.md) | Researchers / devs | DEMs, GeoJSON, CSVs, audio assets |
| [05-features-deep-dive.md](05-features-deep-dive.md) | Developers | Terrain, water simulation, AI scenario chat, voxel world, etc. |
| [06-controls.md](06-controls.md) | Players | Keyboard, mouse, gamepad, touch reference |
| [07-development.md](07-development.md) | Contributors | Local setup, scripts, conventions |
| [08-deployment.md](08-deployment.md) | Maintainers | Publishing, custom domain, edge functions |

Screenshots referenced throughout live in [`./screenshots/`](screenshots/).
