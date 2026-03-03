import { Switch } from '@/components/ui/switch';

interface LegendProps {
  showBorders: boolean;
  onToggleBorders: (val: boolean) => void;
  showRivers: boolean;
  onToggleRivers: (val: boolean) => void;
  show13thBasin: boolean;
  onToggle13thBasin: (val: boolean) => void;
  show19thBasin: boolean;
  onToggle19thBasin: (val: boolean) => void;
  show21stBasin: boolean;
  onToggle21stBasin: (val: boolean) => void;
  showKhorezm: boolean;
  onToggleKhorezm: (val: boolean) => void;
  showWatershed: boolean;
  onToggleWatershed: (val: boolean) => void;
  showLakes: boolean;
  onToggleLakes: (val: boolean) => void;
  showPopDensity: boolean;
  onTogglePopDensity: (val: boolean) => void;
}

const Legend = ({ showBorders, onToggleBorders, showRivers, onToggleRivers, show13thBasin, onToggle13thBasin, show19thBasin, onToggle19thBasin, show21stBasin, onToggle21stBasin, showKhorezm, onToggleKhorezm, showWatershed, onToggleWatershed, showLakes, onToggleLakes, showPopDensity, onTogglePopDensity }: LegendProps) => {
  return (
    <div className="glass-panel p-3 space-y-2 w-72">
      <label className="flex items-center justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block w-3 h-0.5 bg-white/40 rounded" />
          Borders
        </span>
        <Switch className="scale-75" checked={showBorders} onCheckedChange={onToggleBorders} />
      </label>

      <label className="flex items-center justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: '#5b9bd5' }} />
          Amu Darya
        </span>
        <Switch className="scale-75" checked={showRivers} onCheckedChange={onToggleRivers} />
      </label>

      <label className="flex items-center justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: '#e8a838' }} />
          13th Century Basin
        </span>
        <Switch className="scale-75" checked={show13thBasin} onCheckedChange={onToggle13thBasin} />
      </label>

      <label className="flex items-center justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: '#38e8a8' }} />
          19th Century Basin
        </span>
        <Switch className="scale-75" checked={show19thBasin} onCheckedChange={onToggle19thBasin} />
      </label>

      <label className="flex items-center justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: '#e84038' }} />
          21st Century Canals
        </span>
        <Switch className="scale-75" checked={show21stBasin} onCheckedChange={onToggle21stBasin} />
      </label>

      <label className="flex items-center justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: '#2d8fce' }} />
          Lakes
        </span>
        <Switch className="scale-75" checked={showLakes} onCheckedChange={onToggleLakes} />
      </label>

      <label className="flex items-center justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #6b8e23, #8B4513)' }} />
          Khorezm DEM
        </span>
        <Switch className="scale-75" checked={showKhorezm} onCheckedChange={onToggleKhorezm} />
      </label>

      <label className="flex items-center justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #4a90d9, #2d6b3f)' }} />
          Lower Amu Darya DEM
        </span>
        <Switch className="scale-75" checked={showWatershed} onCheckedChange={onToggleWatershed} />
      </label>

      <label className="flex items-center justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #e8c838, #e84038)' }} />
          Population Density
        </span>
        <Switch className="scale-75" checked={showPopDensity} onCheckedChange={onTogglePopDensity} />
      </label>
    </div>
  );
};

export default Legend;
