import { ArrowLeft, ChevronLeft, MapPin, Target } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDesignerScheme } from '@/lib/visual-mode';
import { sfx } from '@/lib/ui-sfx';
import {
  GEO_LOCATIONS,
  haversineKm,
  satelliteImageUrl,
  scoreFor,
  type GeoLocation,
} from '@/lib/geoguessr-locations';

function bgIsLight(hex: string): boolean {
  const h = (hex || '').replace('#', '');
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.55;
}

function PadHint({ label, bg }: { label: string; bg: string }) {
  const ink = bgIsLight(bg) ? '#0a0a0a' : '#ffffff';
  return (
    <span
      className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-bold leading-none rounded ml-2"
      style={{ border: `1.5px solid ${ink}`, color: ink, background: bg, minWidth: 18 }}
    >
      {label}
    </span>
  );
}

interface Guess {
  loc: GeoLocation;
  lat: number;
  lon: number;
  distanceKm: number;
  score: number;
}

interface Props {
  onExit: () => void;
  onPrev?: () => void;
  /** Returns lat/lon of the current crosshair, or null if not aimed. */
  getAimLatLon: () => { lat: number; lon: number } | null;
}

const GeoGuessrHUD = ({ onExit, onPrev, getAimLatLon }: Props) => {
  const [scheme] = useDesignerScheme();
  const stops =
    scheme.terrainStops && scheme.terrainStops.length > 1
      ? scheme.terrainStops
      : [scheme.water, scheme.land, scheme.vegetation, scheme.alert];
  const bgColor = scheme.sceneBackground ?? scheme.background ?? '#000000';
  const inkColor = bgIsLight(bgColor) ? '#0a0a0a' : '#ffffff';

  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState<Guess | null>(null);
  const [history, setHistory] = useState<Guess[]>([]);

  const loc = GEO_LOCATIONS[idx];
  const done = idx >= GEO_LOCATIONS.length;
  const totalScore = useMemo(() => history.reduce((s, g) => s + g.score, 0), [history]);

  const place = () => {
    if (guess || done) return;
    const aim = getAimLatLon();
    if (!aim) return;
    const dKm = haversineKm(aim.lat, aim.lon, loc.lat, loc.lon);
    const score = scoreFor(dKm);
    const g: Guess = { loc, lat: aim.lat, lon: aim.lon, distanceKm: dKm, score };
    setGuess(g);
    setHistory((h) => [...h, g]);
    sfx.make();
  };

  const next = () => {
    setGuess(null);
    setIdx((i) => i + 1);
    sfx.navNext?.();
  };

  // Gamepad: X = place / advance, LB = previous level
  const placeRef = useRef(place);
  const nextRef = useRef(next);
  const prevRef = useRef(onPrev);
  useEffect(() => {
    placeRef.current = place;
    nextRef.current = next;
    prevRef.current = onPrev;
  });

  useEffect(() => {
    let raf = 0;
    let prevState = { x: false, lb: false };
    const tick = () => {
      const pads = navigator.getGamepads?.() ?? [];
      let pad: Gamepad | null = null;
      for (const p of pads) if (p) { pad = p; break; }
      if (pad) {
        const x = !!pad.buttons[2]?.pressed;
        const lb = !!pad.buttons[4]?.pressed;
        if (x && !prevState.x) {
          if (guess) nextRef.current();
          else placeRef.current();
        }
        if (lb && !prevState.lb && prevRef.current) { sfx.navPrev(); prevRef.current(); }
        prevState = { x, lb };
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [guess]);

  const accent = stops[0];

  return (
    <>
      {/* Exit */}
      <div className="absolute top-5 left-5 z-40">
        <button
          onClick={() => { sfx.exit(); onExit(); }}
          className="flex items-center gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.3em] bg-black/70 border border-white/20 hover:bg-black/90 transition-colors"
          style={{ color: '#fff' }}
        >
          <ArrowLeft className="w-3 h-3" /> exit
        </button>
      </div>

      {/* Title */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 text-center pointer-events-none">
        <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/40">level 4</div>
        <h1 className="text-2xl font-extralight tracking-[0.4em] uppercase text-white/90">
          Satellite GeoGuessr
        </h1>
      </div>

      {/* Prev arrow */}
      {onPrev && (
        <button
          onClick={() => { sfx.navPrev(); onPrev(); }}
          aria-label="previous level"
          className="fixed left-2 top-1/2 -translate-y-1/2 z-[70] flex flex-col items-center justify-center bg-transparent hover:opacity-70 transition-opacity"
          style={{ color: accent, filter: `drop-shadow(0 0 10px ${bgColor})` }}
        >
          <ChevronLeft style={{ width: 140, height: 140 }} strokeWidth={4} />
          <PadHint label="LB" bg={bgColor} />
        </button>
      )}

      {/* Center crosshair */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
        style={{
          width: 22,
          height: 22,
          border: `2px solid ${accent}`,
          borderRadius: '50%',
          mixBlendMode: 'difference',
        }}
      />

      {/* Satellite reference image (right side) */}
      {!done && (
        <div
          className="fixed top-24 right-6 z-40 p-2 backdrop-blur-md"
          style={{ background: bgColor, border: `1px solid ${inkColor}33` }}
        >
          <img
            src={satelliteImageUrl(loc, 480, 360)}
            alt="Mystery location satellite"
            className="block"
            style={{ width: 360, height: 270, objectFit: 'cover' }}
            draggable={false}
          />
          <div
            className="mt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-center"
            style={{ color: inkColor }}
          >
            location {idx + 1} / {GEO_LOCATIONS.length} · find on map
          </div>
        </div>
      )}

      {/* Bottom action */}
      {!done && !guess && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={place}
            className="flex items-center gap-3 px-6 py-4 text-sm font-semibold font-mono uppercase tracking-[0.2em] backdrop-blur-md transition-all hover:brightness-110 hover:scale-105"
            style={{
              border: `3px solid ${accent}`,
              background: bgColor,
              color: inkColor,
              boxShadow: `0 0 24px ${accent}55`,
            }}
            title="Place guess where the crosshair is aimed"
          >
            <Target className="w-4 h-4" style={{ color: accent }} />
            Place guess
            <PadHint label="X" bg={bgColor} />
          </button>
        </div>
      )}

      {/* Result panel */}
      {!done && guess && (
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 px-6 py-4 backdrop-blur-md font-mono text-[12px]"
          style={{
            background: bgColor,
            color: inkColor,
            border: `2px solid ${accent}`,
            minWidth: 360,
            textAlign: 'center',
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.3em] opacity-60 mb-1">
            {guess.loc.name}
          </div>
          <div className="text-2xl font-light" style={{ color: accent }}>
            {guess.distanceKm.toFixed(1)} km away
          </div>
          <div className="mt-1">+{guess.score.toLocaleString()} pts</div>
          {guess.loc.hint && (
            <div className="opacity-70 mt-2 text-[11px] italic">{guess.loc.hint}</div>
          )}
          <button
            onClick={next}
            className="mt-3 px-5 py-2 text-[11px] uppercase tracking-[0.3em] hover:brightness-110"
            style={{ border: `2px solid ${accent}`, color: inkColor, background: 'transparent' }}
          >
            {idx + 1 < GEO_LOCATIONS.length ? 'Next location' : 'See results'}
            <PadHint label="X" bg={bgColor} />
          </button>
        </div>
      )}

      {/* Final summary */}
      {done && (
        <div
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-10 py-8 backdrop-blur-md font-mono"
          style={{
            background: bgColor,
            color: inkColor,
            border: `2px solid ${accent}`,
            minWidth: 420,
            textAlign: 'center',
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.4em] opacity-60">final score</div>
          <div className="text-5xl font-light my-3" style={{ color: accent }}>
            {totalScore.toLocaleString()}
          </div>
          <div className="text-[11px] opacity-70 mb-4">/ {GEO_LOCATIONS.length * 5000}</div>
          <div className="space-y-1 text-[11px] text-left">
            {history.map((g, i) => (
              <div key={i} className="flex justify-between gap-6">
                <span className="opacity-80">{g.loc.name}</span>
                <span>
                  {g.distanceKm.toFixed(1)} km · {g.score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setIdx(0); setHistory([]); setGuess(null); }}
            className="mt-5 px-5 py-2 text-[11px] uppercase tracking-[0.3em] hover:brightness-110"
            style={{ border: `2px solid ${accent}`, color: inkColor, background: 'transparent' }}
          >
            Play again
          </button>
        </div>
      )}

      {/* Help bottom-right */}
      {!done && (
        <div
          className="fixed bottom-6 right-6 z-40 px-3 py-2 backdrop-blur-md font-mono text-[10px] tracking-wider"
          style={{ background: bgColor, color: inkColor, border: `1px solid ${inkColor}33` }}
        >
          <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> aim crosshair at the spot you think the photo was taken</div>
          <div className="opacity-60 mt-1">score so far · {totalScore.toLocaleString()}</div>
        </div>
      )}
    </>
  );
};

export default GeoGuessrHUD;
