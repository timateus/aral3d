// Prefetch GHS-POP R2023A (JRC Global Human Settlement Layer) population density
// per location. Downloads the 10°×10° WGS84 tiles (100 m / 3 arc-seconds) that
// cover each bounding box, samples the raster, and writes a compact JSON grid
// per location: {width, height, minLon, minLat, maxLon, maxLat, valuesB64}.
//
// Grid values are population count per 100 m pixel (epoch 2020).
//
// Run: node scripts/prefetch/ghs-pop.mjs [slug1 slug2 ...]
//
// Requires: `npm i -D geotiff adm-zip` (auto-installed by the runner).

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { LOCATIONS } from './locations.mjs';

const require = createRequire(import.meta.url);
const { fromArrayBuffer } = require('geotiff');
const AdmZip = require('adm-zip');

const BASE = 'https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_POP_GLOBE_R2023A/GHS_POP_E2020_GLOBE_R2023A_4326_3ss/V1-0/tiles';
const CACHE = path.join(os.tmpdir(), 'ghs-pop-cache');

// GHS-POP 4326 3ss tiling:
//   Rows: R{r} covers lat [90-10r, 90-10(r-1)], so R1 = 80..90N.
//   Cols: C{c} covers lon [-180+10(c-1), -180+10c], so C1 = -180..-170.
function tileForLatLon(lat, lon) {
  const r = Math.min(18, Math.max(1, Math.ceil((90 - lat) / 10)));
  const c = Math.min(36, Math.max(1, Math.floor((lon + 180) / 10) + 1));
  return { r, c };
}

function tilesForBounds(b) {
  const tiles = new Set();
  const step = 5; // sample interior grid
  for (let lat = b.minLat; lat <= b.maxLat + 0.001; lat += step) {
    for (let lon = b.minLon; lon <= b.maxLon + 0.001; lon += step) {
      const { r, c } = tileForLatLon(lat, lon);
      tiles.add(`${r}_${c}`);
    }
  }
  // Also corners in case bounds are smaller than step.
  for (const [la, lo] of [[b.minLat, b.minLon], [b.minLat, b.maxLon], [b.maxLat, b.minLon], [b.maxLat, b.maxLon]]) {
    const { r, c } = tileForLatLon(la, lo);
    tiles.add(`${r}_${c}`);
  }
  return [...tiles].map((k) => {
    const [r, c] = k.split('_').map(Number);
    return { r, c };
  });
}

async function downloadTile(r, c) {
  await fs.mkdir(CACHE, { recursive: true });
  const tifPath = path.join(CACHE, `R${r}_C${c}.tif`);
  try { await fs.access(tifPath); return tifPath; } catch { /* not cached */ }

  const zipUrl = `${BASE}/GHS_POP_E2020_GLOBE_R2023A_4326_3ss_V1_0_R${r}_C${c}.zip`;
  const zipPath = path.join(CACHE, `R${r}_C${c}.zip`);
  console.log(`  downloading ${zipUrl}`);
  const res = await fetch(zipUrl);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(zipPath, buf);
  console.log(`  ${(buf.length / 1e6).toFixed(1)} MB → extracting…`);

  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries().filter((e) => e.entryName.toLowerCase().endsWith('.tif'));
  if (entries.length === 0) throw new Error('No .tif in zip');
  const tifBuf = entries[0].getData();
  await fs.writeFile(tifPath, tifBuf);
  await fs.rm(zipPath).catch(() => {});
  return tifPath;
}

async function readTile(tifPath) {
  const buf = await fs.readFile(tifPath);
  const tiff = await fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const image = await tiff.getImage();
  const [minLon, minLat, maxLon, maxLat] = image.getBoundingBox();
  const width = image.getWidth();
  const height = image.getHeight();
  return { image, minLon, minLat, maxLon, maxLat, width, height };
}

async function extractGrid(loc) {
  const b = loc.waterBounds ?? loc.bounds;
  const tiles = tilesForBounds(b);
  console.log(`  tiles: ${tiles.map((t) => `R${t.r}C${t.c}`).join(', ')}`);

  // Load all tiles first
  const loaded = [];
  for (const t of tiles) {
    const tifPath = await downloadTile(t.r, t.c);
    const meta = await readTile(tifPath);
    loaded.push(meta);
  }

  // Choose output resolution: ~600 pixels on longest side (keeps files small)
  const maxSide = 600;
  const lonSpan = b.maxLon - b.minLon;
  const latSpan = b.maxLat - b.minLat;
  const aspect = lonSpan / latSpan;
  let W, H;
  if (aspect >= 1) { W = maxSide; H = Math.max(1, Math.round(maxSide / aspect)); }
  else { H = maxSide; W = Math.max(1, Math.round(maxSide * aspect)); }

  const out = new Float32Array(W * H);
  out.fill(0);

  // Sample each output pixel by picking the tile that covers its center.
  for (let j = 0; j < H; j++) {
    const lat = b.maxLat - ((j + 0.5) / H) * latSpan;
    for (let i = 0; i < W; i++) {
      const lon = b.minLon + ((i + 0.5) / W) * lonSpan;
      const tile = loaded.find((t) => lon >= t.minLon && lon <= t.maxLon && lat >= t.minLat && lat <= t.maxLat);
      if (!tile) continue;
      const px = Math.min(tile.width - 1, Math.max(0, Math.floor((lon - tile.minLon) / (tile.maxLon - tile.minLon) * tile.width)));
      const py = Math.min(tile.height - 1, Math.max(0, Math.floor((tile.maxLat - lat) / (tile.maxLat - tile.minLat) * tile.height)));
      // Read a single pixel window (fast enough for 600×600).
      // Batching per-tile would be faster but this keeps code short.
      const win = await tile.image.readRasters({ window: [px, py, px + 1, py + 1], samples: [0] });
      const v = win[0][0];
      out[j * W + i] = isFinite(v) && v > 0 ? v : 0;
    }
    if (j % 50 === 0) process.stdout.write(`\r  sampling ${j}/${H}`);
  }
  process.stdout.write('\r  sampling done            \n');

  return { width: W, height: H, minLon: b.minLon, minLat: b.minLat, maxLon: b.maxLon, maxLat: b.maxLat, values: out };
}

async function main() {
  const requested = process.argv.slice(2);
  const targets = requested.length
    ? LOCATIONS.filter((l) => requested.includes(l.slug))
    : LOCATIONS;

  for (const loc of targets) {
    console.log(`\n[${loc.slug}] GHS-POP…`);
    const grid = await extractGrid(loc);
    const valuesB64 = Buffer.from(grid.values.buffer).toString('base64');
    const outFile = path.join('public/data/locations', loc.slug, 'population_density.json');
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    const doc = {
      source: 'GHS-POP R2023A (JRC), epoch 2020, WGS84 3 arc-sec (~100 m)',
      units: 'population count per source pixel',
      width: grid.width, height: grid.height,
      minLon: grid.minLon, minLat: grid.minLat, maxLon: grid.maxLon, maxLat: grid.maxLat,
      valuesB64,
    };
    await fs.writeFile(outFile, JSON.stringify(doc));
    const stat = await fs.stat(outFile);
    console.log(`  ${grid.width}×${grid.height} → ${outFile} (${(stat.size / 1024).toFixed(1)} KB)`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
