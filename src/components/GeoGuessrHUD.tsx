import { ArrowLeft, ChevronLeft, MapPin, Target, Clock, Satellite, Map as MapIcon, ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDesignerScheme } from '@/lib/visual-mode';
import { useTerrainMode } from '@/hooks/useTerrainMode';
import { sfx } from '@/lib/ui-sfx';
import { consumeGamepadButton } from '@/lib/gamepad-dedupe';
import {
  GEO_LOCATIONS,
  haversineKm,
  satelliteImageUrl,
  scoreFor,
  type GeoLocation,
} from '@/lib/geoguessr-locations';

const GUESS_SECONDS = 60;

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

export interface GeoGuessrMarkers {
  guess?: { lat: number; lon: number } | null;
  truth?: { lat: number; lon: number; name: string } | null;
  all?: { truth: { lat: number; lon: number; name: string }; guess: { lat: number; lon: number } }[];
}

interface Props {
  onExit: () => void;
  onPrev?: () => void;
  /** Returns lat/lon of the current crosshair, or null if not aimed. */
  getAimLatLon: () => { lat: number; lon: number } | null;
  /** Returns lat/lon under a screen-space (clientX, clientY) point. */
  getLatLonAtScreen?: (x: number, y: number) => { lat: number; lon: number } | null;
  /** Push current guess/truth markers up so the terrain can render them. */
  onMarkersChange?: (markers: GeoGuessrMarkers | null) => void;
}

const GeoGuessrHUD = ({ onExit, onPrev, getAimLatLon, getLatLonAtScreen, onMarkersChange }: Props) => {
  const [scheme] = useDesignerScheme();
  const { mode: terrainMode, setMode: setTerrainMode } = useTerrainMode();
  const stops =
    scheme.terrainStops && scheme.terrainStops.length > 1
      ? scheme.terrainStops
      : [scheme.water, scheme.land, scheme.vegetation, scheme.alert];
  const bgColor = scheme.sceneBackground ?? scheme.background ?? '#000000';
  const inkColor = bgIsLight(bgColor) ? '#0a0a0a' : '#ffffff';
  const accent = stops[0];

  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState<Guess | null>(null);
  const [pending, setPending] = useState<{ lat: number; lon: number } | null>(null);
  const [history, setHistory] = useState<Guess[]>([]);
  const [timeLeft, setTimeLeft] = useState(GUESS_SECONDS);

  const loc = GEO_LOCATIONS[idx];
  const done = idx >= GEO_LOCATIONS.length;
  const totalScore = useMemo(() => history.reduce((s, g) => s + g.score, 0), [history]);

  // Refs so the gamepad poll loop never resets and doesn't re-fire on stale presses
  const guessRef = useRef<Guess | null>(null);
  const doneRef = useRef(false);
  const idxRef = useRef(0);
  const locRef = useRef(loc);
  useEffect(() => { guessRef.current = guess; }, [guess]);
  useEffect(() => { doneRef.current = done; idxRef.current = idx; locRef.current = GEO_LOCATIONS[idx]; }, [idx, done]);

  // Push markers up so the terrain can render guess + truth + arc (or all when done)
  useEffect(() => {
    if (!onMarkersChange) return;
    if (done) {
      onMarkersChange({
        all: history.map((g) => ({
          truth: { lat: g.loc.lat, lon: g.loc.lon, name: g.loc.name },
          guess: { lat: g.lat, lon: g.lon },
        })),
      });
    } else if (guess) {
      onMarkersChange({
        guess: { lat: guess.lat, lon: guess.lon },
        truth: { lat: guess.loc.lat, lon: guess.loc.lon, name: guess.loc.name },
      });
    } else if (pending) {
      onMarkersChange({ guess: { lat: pending.lat, lon: pending.lon } });
    } else {
      onMarkersChange(null);
    }
    return () => { onMarkersChange(null); };
  }, [guess, pending, done, history, onMarkersChange]);

  const place = (latOverride?: number, lonOverride?: number) => {
    if (guessRef.current || doneRef.current) return;
    let lat: number, lon: number;
    if (latOverride !== undefined && lonOverride !== undefined) {
      lat = latOverride; lon = lonOverride;
    } else {
      const aim = getAimLatLon();
      if (!aim) return;
      lat = aim.lat; lon = aim.lon;
    }
    const target = locRef.current;
    const dKm = haversineKm(lat, lon, target.lat, target.lon);
    const score = scoreFor(dKm);
    console.log('[geoguessr] place', {
      target: target.name, targetLatLon: [target.lat, target.lon],
      guessLatLon: [lat, lon], distanceKm: dKm, score,
      usedFallback: !(latOverride === undefined),
    });
    const g: Guess = { loc: target, lat, lon, distanceKm: dKm, score };
    setGuess(g);
    setHistory((h) => [...h, g]);
    sfx.make();
  };

  const next = () => {
    setGuess(null);
    setIdx((i) => i + 1);
    setTimeLeft(GUESS_SECONDS);
    sfx.navNext?.();
  };

  // 60s countdown — auto-place when expires
  useEffect(() => {
    if (guess || done) return;
    setTimeLeft(GUESS_SECONDS);
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          // auto-place: use crosshair if aimed, else center of bounds (~no guess → 0 pts at far)
          const aim = getAimLatLon();
          if (aim) place(aim.lat, aim.lon);
          else {
            // fallback huge distance → 0 score
            const target = locRef.current;
            place(target.lat + 5, target.lon + 5);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [idx, guess, done]);

  // Gamepad: X = place / advance, LB = previous level — with proper edge detection
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const pads = navigator.getGamepads?.() ?? [];
      let pad: Gamepad | null = null;
      for (const p of pads) if (p) { pad = p; break; }
      if (pad) {
        const x = !!pad.buttons[2]?.pressed;
        const lb = !!pad.buttons[4]?.pressed;
        if (consumeGamepadButton('x', x, { cooldownMs: 700 })) {
          if (doneRef.current) {
            // nothing
          } else if (guessRef.current) {
            next();
          } else if (pendingRef.current) {
            confirmPending();
          } else {
            place();
          }
        }
        if (consumeGamepadButton('lb', lb) && onPrev) {
          sfx.navPrev();
          onPrev();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click handler also throttled (in case the on-screen button double-fires)
  const clickGuardRef = useRef(0);
  const guardedPlace = () => {
    const now = performance.now();
    if (now - clickGuardRef.current < 300) return;
    clickGuardRef.current = now;
    place();
  };
  const guardedNext = () => {
    const now = performance.now();
    if (now - clickGuardRef.current < 300) return;
    clickGuardRef.current = now;
    next();
  };

  // Mouse click on the map while guessing → set a PENDING guess (requires confirmation).
  // Google Earth is only opened from the satellite image (no longer from a map click).
  const pendingRef = useRef<{ lat: number; lon: number } | null>(null);
  useEffect(() => { pendingRef.current = pending; }, [pending]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('button, a, input, select, textarea, [data-hud]')) return;
      if (doneRef.current || guessRef.current) return;
      if (!getLatLonAtScreen) return;
      const ll = getLatLonAtScreen(e.clientX, e.clientY);
      if (!ll) return;
      const now = performance.now();
      if (now - clickGuardRef.current < 300) return;
      clickGuardRef.current = now;
      setPending({ lat: ll.lat, lon: ll.lon });
      sfx.navNext?.();
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getLatLonAtScreen]);

  const confirmPending = () => {
    const p = pendingRef.current;
    if (!p) return;
    setPending(null);
    place(p.lat, p.lon);
  };
  const cancelPending = () => { setPending(null); sfx.exit?.(); };


  // Keyboard navigation (no controller required)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      if (e.key === 'Escape' && pendingRef.current) {
        e.preventDefault(); cancelPending(); return;
      }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        if (doneRef.current) return;
        if (guessRef.current) { guardedNext(); return; }
        if (pendingRef.current) { confirmPending(); return; }
        guardedPlace();
      } else if ((e.key === 'ArrowLeft' || e.key === 'Backspace') && onPrev) {
        e.preventDefault();
        sfx.navPrev();
        onPrev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPrev]);

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

      {/* Center crosshair (only while guessing) */}
      {!done && !guess && (
        <div
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
          style={{
            width: 22, height: 22,
            border: `2px solid ${accent}`, borderRadius: '50%',
            mixBlendMode: 'difference',
          }}
        />
      )}

      {/* Satellite reference image (right side) — visible while guessing AND while reviewing */}
      {!done && (
        <div
          data-hud
          className="fixed top-24 right-6 z-40 p-2 backdrop-blur-md"
          style={{ background: bgColor, border: `1px solid ${inkColor}33` }}
        >
          {/* Name shown immediately — large + bold */}
          <div
            className="mb-2 px-1 font-mono font-extrabold uppercase text-center"
            style={{
              color: accent,
              fontSize: 22,
              letterSpacing: '0.18em',
              textShadow: `0 2px 10px ${bgColor}, 0 0 24px ${accent}66`,
            }}
          >
            {loc.name}
          </div>
          <a
            href={`https://earth.google.com/web/@${loc.lat},${loc.lon},0a,2000d,35y,0h,0t,0r`}
            target="_blank"
            rel="noopener noreferrer"
            className="block relative group"
            title="Open this location in Google Earth"
          >
            <img
              key={loc.id}
              src={satelliteImageUrl(loc, 480, 360)}
              alt={loc.name}
              className="block"
              style={{ width: 360, height: 270, objectFit: 'cover' }}
              draggable={false}
            />
            <div
              className="absolute bottom-1 right-1 flex items-center gap-1 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: bgColor, color: inkColor, border: `1px solid ${inkColor}44` }}
            >
              <ExternalLink className="w-2.5 h-2.5" /> google earth
            </div>
          </a>
          <div
            className="mt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-center flex items-center justify-center gap-3"
            style={{ color: inkColor }}
          >
            <span>location {idx + 1} / {GEO_LOCATIONS.length}</span>
            {!guess && (
              <span className="flex items-center gap-1" style={{ color: timeLeft <= 10 ? '#ff3b30' : inkColor }}>
                <Clock className="w-3 h-3" /> {timeLeft}s
              </span>
            )}
          </div>
        </div>
      )}

      {/* Satellite / Classic terrain switcher (top-right) */}
      <div
        data-hud
        className="fixed top-5 right-6 z-50 flex items-center gap-1 p-1 backdrop-blur-md"
        style={{ background: bgColor, border: `1px solid ${inkColor}33` }}
      >
        <button
          onClick={() => setTerrainMode('classic')}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.2em]"
          style={{
            background: terrainMode === 'classic' ? `${inkColor}1f` : 'transparent',
            color: inkColor,
            border: `1px solid ${terrainMode === 'classic' ? inkColor : 'transparent'}`,
          }}
          title="Classic terrain"
        >
          <MapIcon className="w-3 h-3" /> classic
        </button>
        <button
          onClick={() => setTerrainMode('satellite')}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.2em]"
          style={{
            background: terrainMode === 'satellite' ? `${inkColor}1f` : 'transparent',
            color: inkColor,
            border: `1px solid ${terrainMode === 'satellite' ? inkColor : 'transparent'}`,
          }}
          title="Satellite basemap"
        >
          <Satellite className="w-3 h-3" /> satellite
        </button>
      </div>

      {/* Bottom action — guessing */}
      {!done && !guess && !pending && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={guardedPlace}
            className="flex items-center gap-3 px-6 py-4 text-sm font-semibold font-mono uppercase tracking-[0.2em] backdrop-blur-md transition-all hover:brightness-110 hover:scale-105"
            style={{
              border: `3px solid ${accent}`, background: bgColor, color: inkColor,
              boxShadow: `0 0 24px ${accent}55`,
            }}
            title="Place guess where the crosshair is aimed"
          >
            <Target className="w-4 h-4" style={{ color: accent }} />
            Place guess
            <PadHint label="X" bg={bgColor} />
          </button>
          <div
            className="mt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-center opacity-70"
            style={{ color: inkColor }}
          >
            tip · click anywhere on the map to drop a pin
          </div>
        </div>
      )}

      {/* Pending guess — requires confirmation */}
      {!done && !guess && pending && (
        <div
          data-hud
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 px-5 py-4 backdrop-blur-md font-mono"
          style={{
            background: bgColor, color: inkColor,
            border: `2px dashed ${accent}`,
            minWidth: 460, textAlign: 'center',
            boxShadow: `0 0 24px ${accent}55`,
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.3em] opacity-70 mb-1">
            confirm your final guess?
          </div>
          <div className="text-[13px] mb-3" style={{ color: accent }}>
            {pending.lat.toFixed(3)}°, {pending.lon.toFixed(3)}°
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={cancelPending}
              className="px-4 py-2 text-[10px] uppercase tracking-[0.3em] hover:brightness-110"
              style={{ border: `1px solid ${inkColor}55`, color: inkColor, background: 'transparent' }}
              title="Pick a different spot (Esc)"
            >
              cancel
            </button>
            <button
              onClick={confirmPending}
              className="flex items-center gap-2 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] hover:brightness-110"
              style={{ border: `2px solid ${accent}`, color: inkColor, background: `${accent}22` }}
              title="Confirm this final guess"
            >
              <Target className="w-3 h-3" style={{ color: accent }} />
              confirm guess
              <PadHint label="X" bg={bgColor} />
            </button>
          </div>
        </div>
      )}

      {/* Result panel — shows distance + lets the user explore the true location */}
      {!done && guess && (
        <div
          data-hud
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 px-6 py-4 backdrop-blur-md font-mono text-[12px]"
          style={{
            background: bgColor, color: inkColor,
            border: `2px solid ${accent}`,
            minWidth: 420, textAlign: 'center',
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
          <div className="flex items-center justify-center gap-2 mt-3">
            <a
              href={`https://earth.google.com/web/@${guess.loc.lat},${guess.loc.lon},0a,2000d,35y,0h,0t,0r`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-2 text-[10px] uppercase tracking-[0.3em] hover:brightness-110"
              style={{ border: `1px solid ${inkColor}55`, color: inkColor, background: 'transparent' }}
            >
              <ExternalLink className="w-3 h-3" /> open in Google Earth
            </a>
            <button
              onClick={guardedNext}
              className="px-5 py-2 text-[11px] uppercase tracking-[0.3em] hover:brightness-110"
              style={{ border: `2px solid ${accent}`, color: inkColor, background: 'transparent' }}
            >
              {idx + 1 < GEO_LOCATIONS.length ? 'Next location' : 'See results'}
              <PadHint label="X" bg={bgColor} />
            </button>
          </div>
        </div>
      )}

      {/* Final summary — compact side panel so the map stays visible */}
      {done && (
        <div
          className="fixed top-20 right-6 bottom-6 z-50 font-mono w-[360px] flex flex-col"
          style={{
            background: bgColor,
            color: inkColor,
            border: `1px solid ${inkColor}33`,
          }}
        >
          <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${inkColor}22` }}>
            <div className="text-[10px] uppercase tracking-[0.4em] opacity-70 text-center">final score</div>
            <div
              className="text-5xl font-bold my-1 text-center tabular-nums"
              style={{ color: inkColor }}
            >
              {totalScore.toLocaleString()}
            </div>
            <div className="text-[10px] opacity-60 text-center">
              / {GEO_LOCATIONS.length * 5000} · pins on the map
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {history.map((g, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-1.5"
                style={{ background: `${inkColor}0a`, border: `1px solid ${inkColor}22` }}
              >
                <img
                  src={satelliteImageUrl(g.loc, 160, 120)}
                  alt={g.loc.name}
                  style={{ width: 64, height: 48, objectFit: 'cover', flexShrink: 0 }}
                  draggable={false}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider truncate">
                    {g.loc.name}
                  </div>
                  <div className="text-[10px] opacity-70">
                    {g.distanceKm.toFixed(1)} km
                  </div>
                </div>
                <div className="text-sm font-bold tabular-nums">
                  +{g.score.toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-2 px-3 py-3" style={{ borderTop: `1px solid ${inkColor}22` }}>
            <button
              onClick={() => { setIdx(0); setHistory([]); setGuess(null); setTimeLeft(GUESS_SECONDS); }}
              className="px-3 py-1.5 text-[10px] uppercase tracking-[0.3em] hover:brightness-110"
              style={{ border: `1px solid ${inkColor}55`, color: inkColor, background: 'transparent' }}
            >
              Play again
            </button>
            <button
              onClick={() => { sfx.exit(); onExit(); }}
              className="px-3 py-1.5 text-[10px] uppercase tracking-[0.3em] hover:brightness-110"
              style={{ border: `1px solid ${inkColor}33`, color: inkColor, background: 'transparent' }}
            >
              Exit
            </button>
          </div>
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
