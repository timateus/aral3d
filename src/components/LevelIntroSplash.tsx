import { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { sfx } from '@/lib/ui-sfx';
import { consumeGamepadButton, setGamepadInputBlocked } from '@/lib/gamepad-dedupe';

// Fixed level-1 palette — black bg, white title, soft lavender body, blue pill.
const colors = {
  bg: '#06080e',
  title: '#ffffff',
  body: '#f5f1ff',
  accent: '#ffffff',
  accentBg: '#3b82f6',
  chrome: '#ffffff',
};

interface Props {
  number: number;
  name: string;
  instructions: string[];
  onBegin: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

const LevelIntroSplash = ({ number, name, instructions, onBegin, onPrev, onNext }: Props) => {



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
        background: colors.bg,
        color: colors.body,
      }}
    >

      {onPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); sfx.navPrev(); onPrev(); }}
          aria-label="previous level"
          className="absolute left-4 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-100 opacity-80"
          style={{ color: colors.chrome }}
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
          style={{ color: colors.chrome }}
        >
          <ChevronRight style={{ width: 120, height: 120 }} strokeWidth={3} />
          <div className="font-mono text-xs uppercase tracking-[0.35em]">R1</div>
        </button>
      )}
      <div className="text-center px-8 max-w-3xl">
        <div
          className="text-sm md:text-base font-mono uppercase tracking-[0.5em] mb-6 opacity-80"
          style={{ color: colors.chrome }}
        >
          level {number}
        </div>
        <h1
          className="font-black tracking-[0.06em] uppercase mb-10"
          style={{
            fontFamily: '"Trebuchet MS", "Comic Sans MS", "Inter", system-ui, sans-serif',
            fontSize: 'clamp(56px, 9vw, 132px)',
            lineHeight: 0.95,
            color: colors.title,
            textShadow: '0 10px 40px rgba(0,0,0,0.35)',
          }}
        >
          {name}
        </h1>
        <div className="space-y-5 mb-14">
          {instructions.map((line, i) => (
            <p
              key={i}
              className="italic leading-tight opacity-95"
              style={{
                fontFamily: '"Georgia", "Trebuchet MS", serif',
                fontSize: 'clamp(26px, 3.6vw, 52px)',
                color: colors.body,
              }}
            >
              {line}
            </p>
          ))}
        </div>
        <div
          className="inline-flex items-center gap-4 px-7 py-4 border-2 rounded-sm"
          style={{
            borderColor: `color-mix(in srgb, ${colors.title} 50%, transparent)`,
            background: `color-mix(in srgb, ${colors.title} 10%, transparent)`,
            color: colors.title,
          }}
        >
          <span
            className="inline-flex items-center justify-center w-10 h-10 text-sm font-mono font-bold rounded-full border-2"
            style={{
              borderColor: colors.accentBg,
              background: colors.accentBg,
              color: colors.accent,
            }}
          >
            3
          </span>
          <span className="text-sm font-mono uppercase tracking-[0.4em] opacity-90">
            or RB · press to begin
          </span>
        </div>
        <div
          className="mt-5 text-xs font-mono uppercase tracking-[0.3em] opacity-70"
          style={{ color: colors.chrome }}
        >
          (or click anywhere)
        </div>
      </div>

    </div>
  );
};


export default LevelIntroSplash;
