import { BLOCKS, type BlockId } from '@/lib/voxel/block-types';
import { RECIPES } from '@/lib/voxel/recipes';
import { useVoxelInventory } from '@/hooks/useVoxelInventory';
import { X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
}

const VoxelInventoryPanel = ({ open, onClose }: Props) => {
  const { hotbar, craft, add } = useVoxelInventory();

  if (!open) return null;

  const counts: Partial<Record<BlockId, number>> = {};
  for (const s of hotbar) if (s.block) counts[s.block] = (counts[s.block] ?? 0) + s.count;

  const canCraft = (inputs: { block: BlockId; count: number }[]) =>
    inputs.every(inp => (counts[inp.block] ?? 0) >= inp.count);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center font-mono p-4" onClick={onClose}>
      <div className="bg-black border border-white/20 max-w-2xl w-full p-4 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
          <div className="text-sm uppercase tracking-widest">Inventory &amp; Crafting</div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-9 gap-1 mb-4">
          {hotbar.map((slot, i) => {
            const def = slot.block ? BLOCKS[slot.block] : null;
            return (
              <div key={i} className="w-full aspect-square border border-white/20 bg-white/5 flex flex-col items-center justify-center">
                {def ? (
                  <>
                    <div className="w-6 h-6 border border-black/30" style={{ background: def.color }} />
                    <div className="text-[9px] text-white/70 mt-0.5">{slot.count}</div>
                    <div className="text-[8px] text-white/40">{def.label}</div>
                  </>
                ) : (
                  <div className="text-white/20 text-[10px]">{i + 1}</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2">Recipes</div>
        <div className="space-y-1.5">
          {RECIPES.map(r => {
            const ok = canCraft(r.inputs);
            return (
              <button
                key={r.id}
                disabled={!ok}
                onClick={() => {
                  if (craft(r.inputs)) {
                    add(r.output.block, r.output.count);
                    toast.success(`Crafted ${r.output.count}× ${BLOCKS[r.output.block].label}`);
                  }
                }}
                className={`w-full text-left px-3 py-2 border flex items-center justify-between gap-2 transition-colors ${
                  ok ? 'border-primary/60 bg-primary/10 text-white hover:bg-primary/20'
                     : 'border-white/10 bg-white/5 text-white/40 cursor-not-allowed'
                }`}
              >
                <div>
                  <div className="text-xs font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> {r.name}
                  </div>
                  <div className="text-[10px] text-white/50 mt-0.5">{r.description}</div>
                  <div className="text-[10px] mt-1 flex gap-2 flex-wrap">
                    {r.inputs.map((inp, i) => {
                      const have = counts[inp.block] ?? 0;
                      const enough = have >= inp.count;
                      return (
                        <span key={i} className={enough ? 'text-white/70' : 'text-red-400'}>
                          {inp.count}× {BLOCKS[inp.block].label} ({have})
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 border border-black/30" style={{ background: BLOCKS[r.output.block].color }} />
                  <div className="text-xs">×{r.output.count}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 pt-2 border-t border-white/10 text-[10px] text-white/40">
          Tip: walk up to a camel and press <span className="text-white/70">M</span> to milk. Press <span className="text-white/70">E</span> or Esc to close.
        </div>
      </div>
    </div>
  );
};

export default VoxelInventoryPanel;
