import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Parse any CSS color string into [r,g,b] using a throwaway DOM node.
const parseColor = (css: string): [number, number, number] | null => {
  if (typeof window === 'undefined') return null;
  const probe = document.createElement('div');
  probe.style.color = css;
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  const m = computed.match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return null;
  return [parseFloat(m[0]), parseFloat(m[1]), parseFloat(m[2])];
};
const relLum = ([r, g, b]: [number, number, number]) => {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const la = relLum(a), lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
// Pick the candidate palette color with the best contrast vs bg, falling back
// to pure white/black if no palette swatch reaches AA (4.5:1).
const pickContrast = (bgVar: string, candidateVars: string[]): string => {
  const bgRaw = getComputedStyle(document.documentElement).getPropertyValue(bgVar).trim() || '#2a2042';
  const bg = parseColor(bgRaw);
  if (!bg) return '#ffffff';
  let best: { color: string; ratio: number } = { color: '#ffffff', ratio: 0 };
  for (const v of [...candidateVars, '#ffffff', '#000000']) {
    const raw = v.startsWith('--')
      ? getComputedStyle(document.documentElement).getPropertyValue(v).trim()
      : v;
    if (!raw) continue;
    const rgb = parseColor(raw);
    if (!rgb) continue;
    const ratio = contrast(bg, rgb);
    if (ratio > best.ratio) best = { color: raw, ratio };
  }
  return best.color;
};
import { sfx } from '@/lib/ui-sfx';
import { consumeGamepadButton, setGamepadInputBlocked } from '@/lib/gamepad-dedupe';

interface Props {
  number: number;
  name: string;
  instructions: string[];
  onBegin: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

const LevelIntroSplash = ({ number, name, instructions, onBegin, onPrev, onNext }: Props) => {
  // High-contrast text/accent colors derived from the active terrain palette.
  const [colors, setColors] = useState(() => ({
    text: '#ffffff',
    accent: '#ffffff',
    accentBg: '#000000',
  }));
  useEffect(() => {
    const recompute = () => {
      const text = pickContrast('--map-land', [
        '--map-vegetation',
        '--map-background',
        '--map-alert',
      ]);
      const accentBg = pickContrast('--map-land', ['--map-alert', '--map-background']);
      const accent = pickContrast('--map-alert', ['--map-background', '--map-vegetation']);
      setColors({ text, accent, accentBg });
    };
    recompute();
    const id = window.setTimeout(recompute, 50);
    return () => window.clearTimeout(id);
  }, []);

  // Gamepad X (2) / A (0) / RB (5) / RT (7) dismiss.
  // Merge button state across ALL connected pads so a ghost/inactive pad at
  // index 0 doesn't mask presses coming from a real controller at a higher index.
  useEffect(() => {
    let raf = 0;
    setGamepadInputBlocked(true);
    const collectPads = (): Gamepad[] => {
      const raw = navigator.getGamepads?.() ?? [];
      const out: Gamepad[] = [];
      for (const p of raw) if (p) out.push(p);
      return out;
    };
    const anyPressed = (pads: Gamepad[], idx: number) =>
      pads.some((p) => !!p.buttons[idx]?.pressed);
    // Seed prev state so we require a fresh rising edge after mount,
    // regardless of buttons held while the splash was opening.
    const pads0 = collectPads();
    consumeGamepadButton('splash-x', anyPressed(pads0, 2), { ignoreBlock: true });
    consumeGamepadButton('splash-lb', anyPressed(pads0, 4), { ignoreBlock: true });
    consumeGamepadButton('splash-rb', anyPressed(pads0, 5), { ignoreBlock: true });
    consumeGamepadButton('splash-rt', anyPressed(pads0, 7), { ignoreBlock: true });
    consumeGamepadButton('splash-a', anyPressed(pads0, 0), { ignoreBlock: true });
    let done = false;
    const tick = () => {
      if (done) return;
      const pads = collectPads();
      if (pads.length) {
        const fire = (n: string, b: number) =>
          consumeGamepadButton(n, anyPressed(pads, b), { cooldownMs: 700, ignoreBlock: true });
        if (fire('splash-lb', 4) && onPrev) {
          sfx.navPrev();
          onPrev();
          raf = requestAnimationFrame(tick);
          return;
        }
        if (fire('splash-rb', 5) && onNext) {
          sfx.navNext();
          onNext();
          raf = requestAnimationFrame(tick);
          return;
        }
        if (fire('splash-x', 2) || fire('splash-rt', 7) || fire('splash-a', 0)) {
          done = true;
          sfx.navNext();
          onBegin();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); setGamepadInputBlocked(false); };
  }, [onBegin, onPrev, onNext]);


  // Keyboard: any of Enter / Space / X dismiss.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key.toLowerCase() === 'x') {
        e.preventDefault();
        onBegin();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBegin]);

  return (
    <div
      onClick={() => { sfx.navNext(); onBegin(); }}
      className="fixed inset-0 z-[9999] flex items-center justify-center cursor-pointer animate-in fade-in duration-300"
      style={{
        // Pull the dominant terrain "land" tone from the active palette
        // (set on :root by applyDesignerScheme) — falls back to deep navy.
        background: 'var(--map-land, #2a2042)',
        color: 'var(--map-background, #06080e)',
      }}
    >

      {onPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); sfx.navPrev(); onPrev(); }}
          aria-label="previous level"
          className="absolute left-4 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-100 opacity-80"
          style={{ color: 'var(--map-background, #06080e)' }}
        >
          <ChevronLeft style={{ width: 120, height: 120 }} strokeWidth={3} />
          <div className="font-mono text-xs uppercase tracking-[0.35em]">L1</div>
        </button>
      )}
      {onNext && (
        <button
          onClick={(e) => { e.stopPropagation(); sfx.navNext(); onNext(); }}
          aria-label="next level"
          className="absolute right-4 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-100 opacity-80"
          style={{ color: 'var(--map-background, #06080e)' }}
        >
          <ChevronRight style={{ width: 120, height: 120 }} strokeWidth={3} />
          <div className="font-mono text-xs uppercase tracking-[0.35em]">R1</div>
        </button>
      )}
      <div className="text-center px-8 max-w-3xl">
        <div
          className="text-sm md:text-base font-mono uppercase tracking-[0.5em] mb-6 opacity-70"
          style={{ color: 'var(--map-background, #06080e)' }}
        >
          level {number}
        </div>
        <h1
          className="font-black tracking-[0.06em] uppercase mb-10"
          style={{
            fontFamily: '"Trebuchet MS", "Comic Sans MS", "Inter", system-ui, sans-serif',
            fontSize: 'clamp(56px, 9vw, 132px)',
            lineHeight: 0.95,
            color: 'var(--map-background, #06080e)',
            textShadow: '0 10px 40px rgba(0,0,0,0.25)',
          }}
        >
          {name}
        </h1>
        <div className="space-y-5 mb-14">
          {instructions.map((line, i) => (
            <p
              key={i}
              className="italic leading-tight opacity-90"
              style={{
                fontFamily: '"Georgia", "Trebuchet MS", serif',
                fontSize: 'clamp(26px, 3.6vw, 52px)',
                color: 'var(--map-vegetation, #f5f1ff)',
              }}
            >
              {line}
            </p>
          ))}
        </div>
        <div
          className="inline-flex items-center gap-4 px-7 py-4 border-2 rounded-sm"
          style={{
            borderColor: 'color-mix(in srgb, var(--map-background, #06080e) 50%, transparent)',
            background: 'color-mix(in srgb, var(--map-background, #06080e) 10%, transparent)',
            color: 'var(--map-background, #06080e)',
          }}
        >
          <span
            className="inline-flex items-center justify-center w-10 h-10 text-sm font-mono font-bold rounded-full border-2"
            style={{
              borderColor: 'var(--map-background, #06080e)',
              background: 'var(--map-alert, #3b82f6)',
              color: 'var(--map-background, #06080e)',
            }}
          >
            3
          </span>
          <span className="text-sm font-mono uppercase tracking-[0.4em] opacity-90">
            or RB · press to begin
          </span>
        </div>
        <div
          className="mt-5 text-xs font-mono uppercase tracking-[0.3em] opacity-55"
          style={{ color: 'var(--map-background, #06080e)' }}
        >
          (or click anywhere)
        </div>
      </div>
    </div>
  );
};

export default LevelIntroSplash;
