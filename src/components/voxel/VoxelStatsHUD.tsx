import { useVoxelStats } from '@/hooks/useVoxelStats';
import { Droplet, Wheat, Zap } from 'lucide-react';

const Bar = ({ value, max = 100, color, icon }: { value: number; max?: number; color: string; icon: React.ReactNode }) => (
  <div className="flex items-center gap-1.5">
    <div className="text-white/80">{icon}</div>
    <div className="w-24 h-2 bg-black/60 border border-white/20">
      <div className="h-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
    </div>
    <div className="text-[9px] text-white/60 w-7">{Math.round(value)}</div>
  </div>
);

const VoxelStatsHUD = () => {
  const { stats } = useVoxelStats();
  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 flex gap-2 px-3 py-1.5 bg-black/60 border border-white/15 font-mono pointer-events-none">
      <Bar value={stats.thirst} color="#3da9d4" icon={<Droplet className="w-3 h-3" />} />
      <Bar value={stats.hunger} color="#d49b3d" icon={<Wheat className="w-3 h-3" />} />
      <Bar value={stats.stamina} color="#d4d43d" icon={<Zap className="w-3 h-3" />} />
    </div>
  );
};

export default VoxelStatsHUD;
