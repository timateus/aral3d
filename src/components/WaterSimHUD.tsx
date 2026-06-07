import { ChevronLeft, ChevronRight, ArrowLeft, Droplets, Mountain } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useDesignerScheme } from '@/lib/visual-mode';
import { sfx } from '@/lib/ui-sfx';

function bgIsLight(hex: string): boolean {
  const h = (hex || '').replace('#', '');
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 0.55;
}

function hexLum(hex: string): number {
  const h = (hex || '').replace('#', '');
  if (h.length < 6) return 0;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
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

interface Props {
  onExit: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onAddWaterCenter: () => void;
  onBuildDamCenter: () => void;
  wetPixels?: number;
  damEdits?: number;
}

const WaterSimHUD = ({ onExit, onPrev, onNext, onAddWaterCenter, onBuildDamCenter, wetPixels = 0, damEdits = 0 }: Props) => {
  const [scheme] = useDesignerScheme();
  const stops = (scheme.terrainStops && scheme.terrainStops.length > 1)
    ? scheme.terrainStops
    : [scheme.water, scheme.land, scheme.vegetation, scheme.alert];
  const bgColor = scheme.sceneBackground ?? scheme.background ?? '#000000';
  const inkColor = bgIsLight(bgColor) ? '#0a0a0a' : '#ffffff';

  // Pick arrow color = stop with max contrast vs bg
  const arrowColor = useMemo(() => {
    const bgL = hexLum(bgColor);
    let best = stops[0], bestD = -1;
    for (const c of stops) {
      const d = Math.abs(hexLum(c) - bgL);
      if (d > bestD) { bestD = d; best = c; }
    }
    return best;
  }, [stops, bgColor]);

  // Gamepad: X = place water, B/O = build dam, LB = prev level, RB = next level.
  const addRef = useRef(onAddWaterCenter);
  const damRef = useRef(onBuildDamCenter);
  const prevRef = useRef(onPrev);
  const nextRef = useRef(onNext);
  useEffect(() => { addRef.current = onAddWaterCenter; }, [onAddWaterCenter]);
  useEffect(() => { damRef.current = onBuildDamCenter; }, [onBuildDamCenter]);
  useEffect(() => { prevRef.current = onPrev; }, [onPrev]);
  useEffect(() => { nextRef.current = onNext; }, [onNext]);

  useEffect(() => {
    let raf = 0;
    let prev = { x: false, b: false, lb: false, rb: false };
    const tick = () => {
      const pads = navigator.getGamepads?.() ?? [];
      let pad: Gamepad | null = null;
      for (const p of pads) { if (p) { pad = p; break; } }
      if (pad) {
        const x = !!pad.buttons[2]?.pressed;
        const b = !!pad.buttons[1]?.pressed;
        const lb = !!pad.buttons[4]?.pressed;
        const rb = !!pad.buttons[5]?.pressed;
        if (x && !prev.x) { sfx.make(); addRef.current(); }
        if (b && !prev.b) { sfx.make(); damRef.current(); }
        if (lb && !prev.lb && prevRef.current) { sfx.navPrev(); prevRef.current(); }
        if (rb && !prev.rb && nextRef.current) { sfx.navNext(); nextRef.current(); }
        prev = { x, b, lb, rb };
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

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

      {/* Headline (terrain-colored, same fonts as level 2 / level 1 family) */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 w-[92vw] text-center pointer-events-none px-6">
        <div
          style={{
            fontFamily: '"Georgia", "Times New Roman", serif',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(22px, 3.2vw, 44px)',
            lineHeight: 1.15,
            letterSpacing: '0.01em',
            textShadow: '0 1px 2px rgba(0,0,0,0.35)',
          }}
        >
          {(() => {
            const text = 'do you feel the wetness of water?';
            return text.split(/(\s+)/).map((tok, i) => {
              if (/^\s+$/.test(tok)) return <span key={i}>{tok}</span>;
              const c = stops[i % stops.length];
              return <span key={i} style={{ color: c }}>{tok}</span>;
            });
          })()}
        </div>
      </div>

      {/* Title */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 text-center pointer-events-none">
        <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/40">level 3</div>
        <h1 className="text-2xl font-extralight tracking-[0.4em] uppercase text-white/90">
          Hydraulic Sandbox
        </h1>
      </div>

      {/* Prev arrow (back to level 2) — same look as level 2 */}
      {onPrev && (
        <button
          onClick={() => { sfx.navPrev(); onPrev(); }}
          aria-label="previous level"
          className="fixed left-2 top-1/2 -translate-y-1/2 z-[70] flex flex-col items-center justify-center bg-transparent hover:opacity-70 transition-opacity"
          style={{ color: arrowColor, filter: `drop-shadow(0 0 10px ${bgColor})` }}
        >
          <ChevronLeft style={{ width: 140, height: 140 }} strokeWidth={4} />
          <PadHint label="LB" bg={bgColor} />
        </button>
      )}

      {/* Next arrow (to level 4) */}
      {onNext && (
        <button
          onClick={() => { sfx.navNext(); onNext(); }}
          aria-label="next level"
          className="fixed right-2 top-1/2 -translate-y-1/2 z-[70] flex flex-col items-center justify-center bg-transparent hover:opacity-70 transition-opacity"
          style={{ color: arrowColor, filter: `drop-shadow(0 0 10px ${bgColor})` }}
        >
          <ChevronRight style={{ width: 140, height: 140 }} strokeWidth={4} />
          <PadHint label="RB" bg={bgColor} />
        </button>
      )}

      {/* Center crosshair so users know where X / B will apply */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
        style={{ width: 22, height: 22, border: `2px solid ${arrowColor}`, borderRadius: '50%', mixBlendMode: 'difference' }}
      />

      {/* Bottom action buttons */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4">
        <button
          onClick={() => { sfx.make(); onAddWaterCenter(); }}
          className="flex items-center gap-3 px-6 py-4 text-sm font-semibold font-mono uppercase tracking-[0.2em] backdrop-blur-md transition-all hover:brightness-110 hover:scale-105"
          style={{
            border: `3px solid ${stops[0]}`,
            background: bgColor,
            color: inkColor,
            boxShadow: `0 0 24px ${stops[0]}55`,
          }}
          title="Place a max-volume splash of water at the cursor"
        >
          <Droplets className="w-4 h-4" style={{ color: stops[0] }} />
          Place water
          <PadHint label="X" bg={bgColor} />
        </button>
        <button
          onClick={() => { sfx.make(); onBuildDamCenter(); }}
          className="flex items-center gap-3 px-6 py-4 text-sm font-semibold font-mono uppercase tracking-[0.2em] backdrop-blur-md transition-all hover:brightness-110 hover:scale-105"
          style={{
            border: `3px solid ${stops[2 % stops.length]}`,
            background: bgColor,
            color: inkColor,
            boxShadow: `0 0 24px ${stops[2 % stops.length]}55`,
          }}
          title="Build a dam at the cursor"
        >
          <Mountain className="w-4 h-4" style={{ color: stops[2 % stops.length] }} />
          Build dam
          <PadHint label="O" bg={bgColor} />
        </button>
      </div>

      {/* Stats */}
      <div
        className="fixed bottom-6 right-6 z-40 px-4 py-3 backdrop-blur-md font-mono text-[11px] tracking-wider"
        style={{ background: bgColor, color: inkColor, border: `1px solid ${inkColor}33` }}
      >
        <div>wet pixels · {wetPixels.toLocaleString()}</div>
        <div>dams built · {damEdits.toLocaleString()}</div>
        <div className="opacity-60 mt-1">click map to splash · drag to paint</div>
      </div>
    </>
  );
};

export default WaterSimHUD;
