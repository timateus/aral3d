import { useEffect, useState } from 'react';
import { BLOCKS, type BlockId } from '@/lib/voxel/block-types';
import { useVoxelInventory, HOTBAR_SIZE } from '@/hooks/useVoxelInventory';
import { Gamepad2 } from 'lucide-react';
import { useGamepad } from '@/hooks/useGamepad';

interface Props {
  locked: boolean;
  onOpenInventory: () => void;
}

const VoxelHUD = ({ locked, onOpenInventory }: Props) => {
  const { hotbar, selected, select } = useVoxelInventory();
  const gp = useGamepad();
  const [hint, setHint] = useState(true);

  // Listen for hotkey events from VoxelPlayer
  useEffect(() => {
    const onSelect = (e: Event) => {
      const i = (e as CustomEvent<number>).detail;
      select(i);
    };
    const onToggle = () => onOpenInventory();
    window.addEventListener('voxel:hotbar-select', onSelect);
    window.addEventListener('voxel:toggle-inventory', onToggle);
    return () => {
      window.removeEventListener('voxel:hotbar-select', onSelect);
      window.removeEventListener('voxel:toggle-inventory', onToggle);
    };
  }, [select, onOpenInventory]);

  // Gamepad dpad → hotbar prev/next (poll via stateRef on connect change)
  useEffect(() => {
    if (!gp.connected) return;
    let lastLeft = false, lastRight = false;
    let raf = 0;
    const tick = () => {
      const b = gp.stateRef.current.buttons;
      if (b.right && !lastRight) select(Math.min(HOTBAR_SIZE - 1, _peekSelected() + 1));
      if (b.left && !lastLeft) select(Math.max(0, _peekSelected() - 1));
      lastLeft = b.left; lastRight = b.right;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gp.connected, gp.stateRef, select]);

  // Helper to read the latest selected value without re-subscribing.
  const _peekSelected = () => selected;

  return (
    <>
      {/* Crosshair */}
      {locked && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-40">
          <div className="w-3 h-3 border border-white/80" style={{ mixBlendMode: 'difference' }} />
        </div>
      )}

      {/* Click-to-play overlay */}
      {!locked && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-30">
          <div className="bg-black/70 border border-white/20 px-6 py-4 text-center font-mono text-white">
            <div className="text-xs uppercase tracking-widest text-white/60 mb-1">Survive Mode</div>
            <div className="text-sm">Click the world to lock pointer and play</div>
            <div className="text-[10px] text-white/50 mt-2 leading-relaxed">
              WASD move · Space jump · Shift sprint<br/>
              Left-click mine · Right-click place<br/>
              1–9 hotbar · E inventory · M milk camel<br/>
              Esc to exit pointer lock
            </div>
          </div>
        </div>
      )}

      {/* Hotbar */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex gap-1 pointer-events-auto">
        {hotbar.map((slot, i) => {
          const isSel = i === selected;
          const def = slot.block ? BLOCKS[slot.block] : null;
          return (
            <button
              key={i}
              onClick={() => select(i)}
              className={`w-12 h-12 border flex flex-col items-center justify-center font-mono text-[9px] transition-colors ${
                isSel ? 'border-white bg-white/15' : 'border-white/20 bg-black/50 hover:border-white/40'
              }`}
            >
              {def ? (
                <>
                  <div className="w-6 h-6 border border-black/40" style={{ background: def.color }} />
                  <div className="text-white/80 text-[10px] leading-none mt-0.5">{slot.count}</div>
                </>
              ) : (
                <div className="text-white/30 text-[10px]">{i + 1}</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Gamepad indicator */}
      {gp.connected && (
        <div className="fixed top-3 right-3 z-40 flex items-center gap-1.5 px-2 py-1 bg-black/60 border border-primary/40 text-primary text-[10px] font-mono uppercase tracking-wider">
          <Gamepad2 className="w-3 h-3" />
          Controller
        </div>
      )}
    </>
  );
};

export default VoxelHUD;
