import { Switch } from '@/components/ui/switch';

interface LegendProps {
  showBorders: boolean;
  onToggleBorders: (val: boolean) => void;
  showRivers: boolean;
  onToggleRivers: (val: boolean) => void;
}

const Legend = ({ showBorders, onToggleBorders, showRivers, onToggleRivers }: LegendProps) => {
  return (
    <div className="glass-panel p-3 space-y-2 w-56">
      <h3 className="text-xs font-semibold text-foreground tracking-wide uppercase">Layers</h3>

      <label className="flex items-center justify-between gap-2 cursor-pointer">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block w-3 h-0.5 bg-white/40 rounded" />
          Uzbekistan Borders
        </span>
        <Switch checked={showBorders} onCheckedChange={onToggleBorders} />
      </label>

      <label className="flex items-center justify-between gap-2 cursor-pointer">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: '#5b9bd5' }} />
          Amu Darya
        </span>
        <Switch checked={showRivers} onCheckedChange={onToggleRivers} />
      </label>
    </div>
  );
};

export default Legend;
