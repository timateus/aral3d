import { STRUCTURES } from '@/lib/voxel/structures';
import { BLOCKS, type BlockId } from '@/lib/voxel/block-types';
import { X, Hammer } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  counts: Partial<Record<BlockId, number>>;
  onBuild: (id: string) => void;
}

const VoxelBuildMenu = ({ open, onClose, counts, onBuild }: Props) => {
  if (!open) return null;
  const canBuild = (cost: { block: BlockId; count: number }[]) =>
    cost.every(c => (counts[c.block] ?? 0) >= c.count);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center font-mono p-4" onClick={onClose}>
      <div className="bg-black border border-white/20 max-w-lg w-full p-4 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
          <div className="text-sm uppercase tracking-widest flex items-center gap-1.5">
            <Hammer className="w-3.5 h-3.5" /> Build Menu
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="text-[10px] text-white/40 mb-3">
          Builds at your current standing position. Stand where you want it.
        </div>
        <div className="space-y-1.5">
          {STRUCTURES.map(s => {
            const ok = canBuild(s.cost);
            return (
              <button
                key={s.id}
                disabled={!ok}
                onClick={() => { onBuild(s.id); onClose(); }}
                className={`w-full text-left px-3 py-2 border transition-colors ${
                  ok ? 'border-primary/60 bg-primary/10 hover:bg-primary/20' : 'border-white/10 bg-white/5 text-white/40 cursor-not-allowed'
                }`}
              >
                <div className="text-xs font-semibold">{s.name}</div>
                <div className="text-[10px] text-white/50 mt-0.5">{s.description}</div>
                <div className="text-[10px] mt-1 flex gap-2 flex-wrap">
                  {s.cost.map((c, i) => {
                    const have = counts[c.block] ?? 0;
                    return (
                      <span key={i} className={have >= c.count ? 'text-white/70' : 'text-red-400'}>
                        {c.count}× {BLOCKS[c.block].label} ({have})
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VoxelBuildMenu;
