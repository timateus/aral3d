import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

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
  show21cLakes?: boolean;
  onToggle21cLakes?: (val: boolean) => void;
  showPopDensity: boolean;
  onTogglePopDensity: (val: boolean) => void;
  popHexSize: number;
  onPopHexSizeChange: (val: number) => void;
  popHexHeight: number;
  onPopHexHeightChange: (val: number) => void;
}

const Legend = ({ showBorders, onToggleBorders, showRivers, onToggleRivers, show13thBasin, onToggle13thBasin, show19thBasin, onToggle19thBasin, show21stBasin, onToggle21stBasin, showKhorezm, onToggleKhorezm, showWatershed, onToggleWatershed, showLakes, onToggleLakes, show21cLakes, onToggle21cLakes, showPopDensity, onTogglePopDensity, popHexSize, onPopHexSizeChange, popHexHeight, onPopHexHeightChange }: LegendProps) => {
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
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: '#4fc3f7' }} />
          Rivers
        </span>
        <Switch className="scale-75" checked={showRivers} onCheckedChange={onToggleRivers} />
      </label>

      <label className="flex items-center justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded-sm border border-amber-500/60" />
          13th c. Basin
        </span>
        <Switch className="scale-75" checked={show13thBasin} onCheckedChange={onToggle13thBasin} />
      </label>

      <label className="flex items-center justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded-sm border border-orange-400/60" />
          19th c. Basin
        </span>
        <Switch className="scale-75" checked={show19thBasin} onCheckedChange={onToggle19thBasin} />
      </label>

      <label className="flex items-center justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded-sm border border-red-400/60" />
          21st c. Basin
        </span>
        <Switch className="scale-75" checked={show21stBasin} onCheckedChange={onToggle21stBasin} />
      </label>

      {onToggle21cLakes && (
        <label className="flex items-center justify-between cursor-pointer">
          <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#ff69b4', borderColor: '#ff85c880', borderWidth: 1 }} />
            21c Lakes
          </span>
          <Switch className="scale-75" checked={!!show21cLakes} onCheckedChange={onToggle21cLakes} />
        </label>
      )}

      <label className="flex items-center justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-700/40 border border-emerald-500/40" />
          Khorezm DEM
        </span>
        <Switch className="scale-75" checked={showKhorezm} onCheckedChange={onToggleKhorezm} />
      </label>

      <label className="flex items-center justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded-sm bg-sky-700/40 border border-sky-400/40" />
          Watershed DEM
        </span>
        <Switch className="scale-75" checked={showWatershed} onCheckedChange={onToggleWatershed} />
      </label>

      <label className="flex items-center justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #440154, #31688e, #35b779, #fde725)' }} />
          Population Density
        </span>
        <Switch className="scale-75" checked={showPopDensity} onCheckedChange={onTogglePopDensity} />
      </label>

      {showPopDensity && (
        <div className="ml-5 space-y-2">
          <div className="flex items-center gap-1">
            <div
              className="h-2 flex-1 rounded-sm"
              style={{
                background: 'linear-gradient(to right, #fde725, #8fd744, #35b779, #21918c, #31688e, #482878, #440154)',
              }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>Low</span>
            <span>High</span>
          </div>
          <div className="text-[9px] text-muted-foreground opacity-70">persons / km²</div>

          <div className="space-y-1 pt-1 border-t border-border/50">
            <label className="text-[10px] text-muted-foreground font-mono">
              Hex Size: {popHexSize.toFixed(2)}
            </label>
            <Slider
              value={[popHexSize]}
              onValueChange={(v) => onPopHexSizeChange(v[0])}
              min={0.05}
              max={0.5}
              step={0.01}
              className="w-full"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-mono">
              Height Exaggeration: {popHexHeight.toFixed(1)}×
            </label>
            <Slider
              value={[popHexHeight]}
              onValueChange={(v) => onPopHexHeightChange(v[0])}
              min={0}
              max={5}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Legend;
