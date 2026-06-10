import { useState, useEffect, useCallback } from 'react';
import { Settings, Volume2, VolumeX } from 'lucide-react';
import BackgroundMusic from './BackgroundMusic';
import { useGamepad } from '@/hooks/useGamepad';

export default function SettingsGear({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => {
    try { return localStorage.getItem('bg-music-muted') === '1'; } catch { return false; }
  });
  const { connected } = useGamepad();

  const readPref = (k: string, dflt: boolean) => {
    try { const v = localStorage.getItem(k); return v == null ? dflt : v === '1'; } catch { return dflt; }
  };
  const [swap, setSwap] = useState<boolean>(() => readPref('pad-swap-xy', true));
  const [invX, setInvX] = useState<boolean>(() => readPref('pad-inv-x', true));
  const [invY, setInvY] = useState<boolean>(() => readPref('pad-inv-y', false));

  useEffect(() => { (globalThis as any).__padSwapRightXY = swap; try { localStorage.setItem('pad-swap-xy', swap ? '1' : '0'); } catch {} }, [swap]);
  useEffect(() => { (globalThis as any).__padInvertRX = invX; try { localStorage.setItem('pad-inv-x', invX ? '1' : '0'); } catch {} }, [invX]);
  useEffect(() => { (globalThis as any).__padInvertRY = invY; try { localStorage.setItem('pad-inv-y', invY ? '1' : '0'); } catch {} }, [invY]);

  const togglePanel = useCallback(() => setOpen((v) => !v), []);

  const stickBtn = (activeFlag: boolean, label: string, onClick: () => void) => (
    <button
      onClick={onClick}
      className={`px-2 py-1 text-[9px] font-mono uppercase tracking-[0.18em] border transition-colors ${
        activeFlag ? 'bg-amber-300 text-black border-amber-200' : 'bg-black/70 text-white/70 border-white/15 hover:bg-black/90'
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <BackgroundMusic active={active} muted={muted} onMutedChange={setMuted} />

      {/* Gear button */}
      <button
        onClick={togglePanel}
        className={`fixed bottom-3 right-3 z-[130] flex items-center justify-center w-9 h-9 border backdrop-blur-md transition-all ${
          open ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-black/70 border-white/15 text-white/70 hover:bg-black/90 hover:text-white'
        }`}
        title="Settings"
        aria-label="Open settings"
      >
        <Settings className="w-4 h-4" />
      </button>

      {/* Settings panel */}
      {open && (
        <div className="fixed bottom-14 right-3 z-[130] w-56 border border-white/15 bg-black/80 backdrop-blur-md p-3 flex flex-col gap-3 pointer-events-auto">
          {/* Sound toggle */}
          <button
            onClick={() => setMuted((m) => !m)}
            className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-white/80 hover:text-white transition-colors"
            aria-label={muted ? 'unmute music' : 'mute music'}
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            {muted ? 'sound off' : 'sound on'}
          </button>

          {/* Divider */}
          <div className="border-t border-white/10" />

          {/* Gamepad stick fix */}
          {connected ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[8px] font-mono uppercase tracking-[0.25em] text-white/45">R-stick</span>
              <div className="flex gap-1 flex-wrap">
                {stickBtn(swap, 'swap xy', () => setSwap((v) => !v))}
                {stickBtn(invX, 'inv x', () => setInvX((v) => !v))}
                {stickBtn(invY, 'inv y', () => setInvY((v) => !v))}
              </div>
            </div>
          ) : (
            <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/40">No controller</span>
          )}
        </div>
      )}
    </>
  );
}
