import { useEffect, useState } from 'react';
import { firstPersonBridge } from '@/lib/first-person-bridge';

/**
 * Big centered place-name banner that triggers while walking through named
 * regions of the Aral basin. Used in Level 5 (Sandspiel Builder) and
 * Level 6 (Kegeyli School 12) where the player navigates first-person.
 *
 * Region detection: simple circular geofences around hand-picked centers.
 * The banner fades in on entry, holds for ~4s, then fades out — and only
 * re-fires for a region after the player has exited and re-entered it.
 */
interface NamedRegion {
  key: string;
  name: string;
  sub?: string;
  lat: number;
  lon: number;
  /** geodesic-ish radius in degrees (1 deg ≈ 111 km) */
  radius: number;
}

// Ordered most-specific first so smaller regions win when nested inside a bigger one.
const REGIONS: NamedRegion[] = [
  // — Most specific first —
  { key: 'muynak',      name: 'Muynak Ship Graveyard',  sub: 'rusted fleet on the dry seabed',  lat: 43.778, lon: 59.030, radius: 0.18 },
  { key: 'kegeyli',     name: 'Kegeyli',                sub: 'home of School 12',                lat: 42.748, lon: 59.583, radius: 0.10 },
  { key: 'nukus',       name: 'Nukus',                  sub: 'capital of Karakalpakstan',        lat: 42.460, lon: 59.610, radius: 0.18 },
  { key: 'khiva',       name: 'Ancient Khorezm',        sub: 'Khiva · oasis civilization',       lat: 41.378, lon: 60.363, radius: 0.30 },
  { key: 'aralsk',      name: 'Aralsk · Kazakhstan',    sub: 'former northern port',             lat: 46.800, lon: 61.660, radius: 0.22 },
  { key: 'vozrozh',     name: 'Vozrozhdeniya Island',   sub: 'biowarfare ghost lab',             lat: 45.150, lon: 59.400, radius: 0.35 },
  // — Kazakhstan regions / landmarks —
  { key: 'barsa',       name: 'Barsakelmes',            sub: '"you go and don\u2019t come back"', lat: 45.700, lon: 59.950, radius: 0.30 },
  { key: 'karatau',     name: 'Karatau Range',          sub: 'black mountains of Kazakhstan',    lat: 43.700, lon: 69.500, radius: 1.20 },
  { key: 'ustyurt',     name: 'Ustyurt Plateau',        sub: 'wind-cut chalk plateau',           lat: 44.500, lon: 56.000, radius: 2.50 },
  { key: 'syrdarya',    name: 'Syr Darya',              sub: 'the other great river of the sea', lat: 45.300, lon: 63.500, radius: 1.40 },
  { key: 'kyzylorda',   name: 'Kyzylorda Region',       sub: 'rice paddies along the Syr Darya', lat: 44.800, lon: 65.500, radius: 1.60 },
  { key: 'mangystau',   name: 'Mangystau · Kazakhstan', sub: 'Caspian shore & oil country',      lat: 44.200, lon: 52.500, radius: 1.80 },
  { key: 'aktobe',      name: 'Aktobe Region',          sub: 'steppe and salt lakes',            lat: 48.500, lon: 58.500, radius: 2.00 },
  // — Broad regions last (largest geofences) —
  { key: 'amudelta',    name: 'Amu Darya Delta',        sub: 'where the river barely reaches',   lat: 43.500, lon: 59.450, radius: 0.55 },
  { key: 'aralkum',     name: 'Aralkum Desert',         sub: 'youngest desert on Earth',         lat: 44.800, lon: 60.000, radius: 1.40 },
  { key: 'kazakhstan',  name: 'Kazakhstan',             sub: 'the great steppe',                 lat: 47.500, lon: 62.000, radius: 4.50 },
  { key: 'karakalpak',  name: 'Karakalpakstan',         sub: '',                                  lat: 43.500, lon: 59.000, radius: 3.50 },
];

interface ShownBanner { key: string; name: string; sub?: string; id: number }

interface Props { active: boolean }

const LocationNameOverlay = ({ active }: Props) => {
  const [banner, setBanner] = useState<ShownBanner | null>(null);

  useEffect(() => {
    if (!active) { setBanner(null); return; }
    let raf = 0;
    let lastKey: string | null = null;
    let hideTimer: number | undefined;
    let idCounter = 0;

    const tick = () => {
      const p = firstPersonBridge.player;
      if (p) {
        let hit: NamedRegion | null = null;
        for (const r of REGIONS) {
          const dlat = p.lat - r.lat;
          const dlon = p.lon - r.lon;
          if (dlat * dlat + dlon * dlon <= r.radius * r.radius) { hit = r; break; }
        }
        const hitKey = hit ? hit.key : null;
        if (hitKey !== lastKey) {
          lastKey = hitKey;
          if (hit) {
            const id = ++idCounter;
            setBanner({ key: hit.key, name: hit.name, sub: hit.sub, id });
            if (hideTimer) window.clearTimeout(hideTimer);
            hideTimer = window.setTimeout(() => {
              setBanner((b) => (b && b.id === id ? null : b));
            }, 4200);
          } else {
            // Leaving a region clears the banner immediately so the next entry can re-fire.
            setBanner(null);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [active]);

  if (!banner) return null;
  return (
    <div
      key={banner.id}
      data-hud
      className="fixed inset-x-0 top-[22vh] z-[95] flex flex-col items-center pointer-events-none px-6 animate-in fade-in slide-in-from-top-4 duration-500"
    >
      <h1
        className="font-black tracking-[0.04em] uppercase text-white text-center"
        style={{
          fontFamily: '"Trebuchet MS", "Comic Sans MS", "Inter", system-ui, sans-serif',
          fontSize: 'clamp(40px, 7vw, 108px)',
          lineHeight: 0.95,
          textShadow: '0 10px 40px rgba(0,0,0,0.85), 0 2px 0 rgba(0,0,0,0.8)',
        }}
      >
        {banner.name}
      </h1>
      {banner.sub && (
        <div
          className="mt-3 text-center text-white/85 italic"
          style={{
            fontFamily: '"Georgia", "Trebuchet MS", serif',
            fontSize: 'clamp(16px, 2vw, 28px)',
            textShadow: '0 4px 18px rgba(0,0,0,0.75)',
          }}
        >
          {banner.sub}
        </div>
      )}
    </div>
  );
};

export default LocationNameOverlay;
