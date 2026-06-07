import { useEffect } from 'react';
import { sfx } from '@/lib/ui-sfx';

interface Props {
  number: number;
  name: string;
  instructions: string[];
  onBegin: () => void;
}

const LevelIntroSplash = ({ number, name, instructions, onBegin }: Props) => {
  // Gamepad X (button 2) dismisses.
  useEffect(() => {
    let raf = 0;
    let prev = false;
    const tick = () => {
      const pads = navigator.getGamepads?.() ?? [];
      let pad: Gamepad | null = null;
      for (const p of pads) { if (p) { pad = p; break; } }
      if (pad) {
        const x = !!pad.buttons[2]?.pressed;
        if (x && !prev) { sfx.navNext(); onBegin(); return; }
        prev = x;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onBegin]);

  // Keyboard: any key / Enter / Space dismisses.
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
      className="fixed inset-0 z-[200] flex items-center justify-center cursor-pointer animate-in fade-in duration-300"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)' }}
    >
      <div className="text-center px-8 max-w-2xl">
        <div className="text-[11px] font-mono uppercase tracking-[0.5em] text-white/50 mb-3">
          level {number}
        </div>
        <h1 className="text-5xl md:text-7xl font-extralight tracking-[0.2em] uppercase text-white mb-8">
          {name}
        </h1>
        <div className="space-y-2 mb-10">
          {instructions.map((line, i) => (
            <p key={i} className="text-base md:text-lg italic text-white/80" style={{ fontFamily: '"Georgia", serif' }}>
              {line}
            </p>
          ))}
        </div>
        <div className="inline-flex items-center gap-3 px-5 py-3 border border-white/40 bg-white/5">
          <span
            className="inline-flex items-center justify-center w-7 h-7 text-xs font-mono font-bold rounded-full border-2 border-white text-white"
          >
            X
          </span>
          <span className="text-[11px] font-mono uppercase tracking-[0.35em] text-white/90">
            press to begin
          </span>
        </div>
        <div className="mt-4 text-[10px] font-mono uppercase tracking-[0.3em] text-white/40">
          (or click anywhere)
        </div>
      </div>
    </div>
  );
};

export default LevelIntroSplash;
