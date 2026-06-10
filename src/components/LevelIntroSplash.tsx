import { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
        background: '#06080e',
      }}
    >

      {onPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); sfx.navPrev(); onPrev(); }}
          aria-label="previous level"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/75 hover:text-white transition-colors"
        >
          <ChevronLeft style={{ width: 120, height: 120 }} strokeWidth={3} />
          <div className="font-mono text-xs uppercase tracking-[0.35em]">L1</div>
        </button>
      )}
      {onNext && (
        <button
          onClick={(e) => { e.stopPropagation(); sfx.navNext(); onNext(); }}
          aria-label="next level"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/75 hover:text-white transition-colors"
        >
          <ChevronRight style={{ width: 120, height: 120 }} strokeWidth={3} />
          <div className="font-mono text-xs uppercase tracking-[0.35em]">R1</div>
        </button>
      )}
      <div className="text-center px-8 max-w-3xl">
        <div className="text-sm md:text-base font-mono uppercase tracking-[0.5em] text-white/55 mb-6">
          level {number}
        </div>
        <h1
          className="font-black tracking-[0.06em] uppercase text-white mb-10"
          style={{
            fontFamily: '"Trebuchet MS", "Comic Sans MS", "Inter", system-ui, sans-serif',
            fontSize: 'clamp(56px, 9vw, 132px)',
            lineHeight: 0.95,
            textShadow: '0 10px 40px rgba(0,0,0,0.6)',
          }}
        >
          {name}
        </h1>
        <div className="space-y-5 mb-14">
          {instructions.map((line, i) => (
            <p
              key={i}
              className="italic text-white/90 leading-tight"
              style={{
                fontFamily: '"Georgia", "Trebuchet MS", serif',
                fontSize: 'clamp(26px, 3.6vw, 52px)',
              }}
            >
              {line}
            </p>
          ))}
        </div>
        <div className="inline-flex items-center gap-4 px-7 py-4 border-2 border-white/50 bg-white/5 rounded-sm">
          <span
            className="inline-flex items-center justify-center w-10 h-10 text-sm font-mono font-bold rounded-full border-2 border-white text-white"
            style={{ background: '#3b82f6' }}
          >
            3
          </span>
          <span className="text-sm font-mono uppercase tracking-[0.4em] text-white/90">
            or RB · press to begin
          </span>
        </div>
        <div className="mt-5 text-xs font-mono uppercase tracking-[0.3em] text-white/45">
          (or click anywhere)
        </div>
      </div>
    </div>
  );
};

export default LevelIntroSplash;
