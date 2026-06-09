import { useEffect, useState } from 'react';
import { firstPersonBridge } from '@/lib/first-person-bridge';

interface Place {
  name: string;
  sub: string;
  lat: number;
  lon: number;
  radiusKm: number;
}

// Khorezm / Karakalpakstan landmarks. Bigger radii cover open desert.
const PLACES: Place[] = [
  { name: 'Kyzylkum Desert',   sub: 'red sand, no water for a hundred miles', lat: 41.6, lon: 62.4, radiusKm: 120 },
  { name: 'Amu Darya',         sub: 'the great river feeding the oasis',      lat: 41.6, lon: 60.9, radiusKm: 35 },
  { name: 'Khazarasp',         sub: 'eastern gate of the Khorezm oasis',      lat: 41.31, lon: 61.07, radiusKm: 18 },
  { name: 'Urgench',           sub: 'capital of Khorezm region',              lat: 41.55, lon: 60.63, radiusKm: 22 },
  { name: 'Khiva',             sub: 'walled silk-road city',                  lat: 41.38, lon: 60.36, radiusKm: 16 },
  { name: 'Beruniy',           sub: 'town named for the polymath al-Biruni',  lat: 41.69, lon: 60.75, radiusKm: 18 },
  { name: 'Karakalpakstan',    sub: 'autonomous republic of the lower Amu',   lat: 42.4, lon: 59.8, radiusKm: 70 },
  { name: 'Nukus',             sub: 'capital of Karakalpakstan',              lat: 42.46, lon: 59.6, radiusKm: 22 },
  { name: 'Chimbay',           sub: 'town in the Amu Darya delta',            lat: 42.94, lon: 59.78, radiusKm: 18 },
  { name: 'Kegeyli',           sub: 'home of School 12',                      lat: 42.76, lon: 59.56, radiusKm: 14 },
];

function distKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLon = (bLon - aLon) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const HEADING_FONT = '"Trebuchet MS", "Comic Sans MS", "Inter", system-ui, sans-serif';
const BODY_FONT = '"Georgia", "Trebuchet MS", serif';

const SchoolPlaceOverlay = ({ hidden = false }: { hidden?: boolean }) => {
  const [place, setPlace] = useState<Place | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let currentName: string | null = null;
    let hideTimer: number | null = null;
    const tick = window.setInterval(() => {
      const p = firstPersonBridge.player;
      if (!p) return;
      // Find the nearest in-radius place.
      let best: Place | null = null;
      let bestD = Infinity;
      for (const pl of PLACES) {
        const d = distKm(p.lat, p.lon, pl.lat, pl.lon);
        if (d <= pl.radiusKm && d < bestD) { best = pl; bestD = d; }
      }
      const name = best?.name ?? null;
      if (name !== currentName) {
        currentName = name;
        if (best) {
          setPlace(best);
          setVisible(true);
          if (hideTimer) window.clearTimeout(hideTimer);
          hideTimer = window.setTimeout(() => setVisible(false), 4200);
        } else {
          setVisible(false);
        }
      }
    }, 400);
    return () => {
      window.clearInterval(tick);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, []);

  if (!place || hidden) return null;
  return (
    <div
      className={`pointer-events-none fixed top-[18%] left-1/2 -translate-x-1/2 z-[70] text-center transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'
      }`}
      data-hud
      style={{ textShadow: '0 8px 36px rgba(0,0,0,0.85)' }}
    >
      <div className="text-xs font-mono uppercase tracking-[0.5em] text-white/55 mb-3">
        you are entering
      </div>
      <h1
        className="font-black uppercase tracking-[0.04em] text-white leading-[0.95]"
        style={{ fontFamily: HEADING_FONT, fontSize: 'clamp(48px,7vw,108px)' }}
      >
        {place.name}
      </h1>
      <p
        className="mt-4 italic text-white/85"
        style={{ fontFamily: BODY_FONT, fontSize: 'clamp(18px,2.2vw,32px)' }}
      >
        {place.sub}
      </p>
    </div>
  );
};

export default SchoolPlaceOverlay;
