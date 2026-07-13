// Prefetch iNaturalist observations per location.
// Run: node scripts/prefetch/inaturalist.mjs [slug1 slug2 ...]

import fs from 'node:fs/promises';
import path from 'node:path';
import { LOCATIONS } from './locations.mjs';

async function fetchInat(b, maxPages = 3) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = new URL('https://api.inaturalist.org/v1/observations');
    url.searchParams.set('nelat', String(b.maxLat));
    url.searchParams.set('nelng', String(b.maxLon));
    url.searchParams.set('swlat', String(b.minLat));
    url.searchParams.set('swlng', String(b.minLon));
    url.searchParams.set('per_page', '200');
    url.searchParams.set('page', String(page));
    url.searchParams.set('photos', 'true');
    url.searchParams.set('quality_grade', 'research');
    url.searchParams.set('order', 'desc');
    url.searchParams.set('order_by', 'observed_on');

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'aral3d/prefetch (data-prep)' },
    });
    if (!res.ok) {
      console.warn(`  page ${page} HTTP ${res.status}`);
      break;
    }
    const json = await res.json();
    for (const r of json.results ?? []) {
      const geo = r.location;
      if (!geo) continue;
      const [latS, lonS] = geo.split(',');
      const lat = parseFloat(latS);
      const lon = parseFloat(lonS);
      if (!isFinite(lat) || !isFinite(lon)) continue;
      const t = r.taxon ?? {};
      const photo = r.photos?.[0]?.url ?? r.observation_photos?.[0]?.photo?.url ?? null;
      out.push({
        id: r.id,
        lat, lon,
        species: t.name ?? null,
        commonName: t.preferred_common_name ?? null,
        iconicTaxon: t.iconic_taxon_name ?? null,
        photoUrl: photo ? photo.replace('/square.', '/medium.') : null,
        observedOn: r.observed_on_details?.date ?? r.observed_on ?? null,
        user: r.user?.login ?? null,
        url: `https://www.inaturalist.org/observations/${r.id}`,
      });
    }
    if ((json.results ?? []).length < 200) break;
    // Rate limit: iNat asks for ≤ 1 req/sec
    await new Promise((r) => setTimeout(r, 1100));
  }
  return out;
}

async function main() {
  const requested = process.argv.slice(2);
  const targets = requested.length
    ? LOCATIONS.filter((l) => requested.includes(l.slug))
    : LOCATIONS;

  for (const loc of targets) {
    console.log(`\n[${loc.slug}] iNaturalist…`);
    const b = loc.waterBounds ?? loc.bounds;
    const obs = await fetchInat(b);
    const outFile = path.join('public/data/locations', loc.slug, 'inaturalist.json');
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.writeFile(outFile, JSON.stringify(obs));
    const stat = await fs.stat(outFile);
    console.log(`  ${obs.length} observations, ${(stat.size / 1024).toFixed(1)} KB → ${outFile}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
