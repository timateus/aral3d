import { useVoxelMissions } from '@/hooks/useVoxelMissions';
import { ScrollText, Check, X } from 'lucide-react';

const VoxelQuestLog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { missions } = useVoxelMissions();
  if (!open) return null;
  const done = missions.filter(m => m.completed).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center font-mono p-4" onClick={onClose}>
      <div className="bg-black border border-white/20 max-w-md w-full p-4 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
          <div className="text-sm uppercase tracking-widest flex items-center gap-1.5">
            <ScrollText className="w-3.5 h-3.5" /> Missions
            <span className="text-white/40">{done}/{missions.length}</span>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-1">
          {missions.map(m => (
            <div
              key={m.id}
              className={`px-3 py-2 border ${
                m.completed ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold flex items-center gap-1.5">
                  {m.completed ? <Check className="w-3 h-3 text-emerald-400" /> : <span className="text-white/40">·</span>}
                  {m.title}
                </div>
                <div className="text-[10px] text-white/60">{m.progress}/{m.target}</div>
              </div>
              <div className="text-[10px] text-white/50 mt-0.5">{m.hint}</div>
              <div className="h-0.5 bg-white/10 mt-1.5">
                <div
                  className={`h-full ${m.completed ? 'bg-emerald-400' : 'bg-primary'}`}
                  style={{ width: `${Math.min(100, (m.progress / m.target) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VoxelQuestLog;
