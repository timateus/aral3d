import { useEffect, useState } from 'react';
import { useGamepad } from '@/hooks/useGamepad';

/**
 * Tiny floating HUD chip that lets the user correct right-stick mapping on
 * non-standard controllers. The browser Gamepad API does not label axes for
 * mapping === "", so this is the only reliable way to fix swaps/inversions.
 */
const GamepadStickFix = () => {
  const { connected } = useGamepad();
  const [swap, setSwap] = useState(false);
  const [invX, setInvX] = useState(false);
  const [invY, setInvY] = useState(false);

  useEffect(() => { (globalThis as any).__padSwapRightXY = swap; }, [swap]);
  useEffect(() => { (globalThis as any).__padInvertRX = invX; }, [invX]);
  useEffect(() => { (globalThis as any).__padInvertRY = invY; }, [invY]);

  if (!connected) return null;
  const btn = (active: boolean) =>
    `px-2 py-1 text-[9px] font-mono uppercase tracking-[0.18em] border transition-colors ${
      active ? 'bg-amber-300 text-black border-amber-200' : 'bg-black/70 text-white/70 border-white/15 hover:bg-black/90'
    }`;
  return (
    <div
      className="fixed bottom-3 right-3 z-[120] flex items-center gap-1 border border-white/10 bg-black/70 backdrop-blur px-2 py-1 pointer-events-auto"
      data-hud
      title="Right-stick mapping override (non-standard controllers)"
    >
      <span className="text-[8px] font-mono uppercase tracking-[0.25em] text-white/45 mr-1">R-stick</span>
      <button className={btn(swap)} onClick={() => setSwap((v) => !v)}>swap xy</button>
      <button className={btn(invX)} onClick={() => setInvX((v) => !v)}>inv x</button>
      <button className={btn(invY)} onClick={() => setInvY((v) => !v)}>inv y</button>
    </div>
  );
};

export default GamepadStickFix;
