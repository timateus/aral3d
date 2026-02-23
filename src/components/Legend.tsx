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
}

const Legend = ({ showBorders, onToggleBorders, showRivers, onToggleRivers, show13thBasin, onToggle13thBasin, show19thBasin, onToggle19thBasin, show21stBasin, onToggle21stBasin, showKhorezm, onToggleKhorezm }: LegendProps) => {
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
    </div>
  );
};

export default Legend;
