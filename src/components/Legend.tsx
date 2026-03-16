import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { INDICATORS } from '@/lib/demographic-data';
import { CLASS_COLORS, CLASS_NAMES } from '@/components/LandcoverLayer';
import { fromArrayBuffer } from 'geotiff';

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
  showLandcover: boolean;
  onToggleLandcover: (val: boolean) => void;
  landcoverVisibleClasses?: Set<number>;
  onLandcoverVisibleClassesChange?: (classes: Set<number> | undefined) => void;
  showLakes: boolean;
  onToggleLakes: (val: boolean) => void;
  show21cLakes?: boolean;
  onToggle21cLakes?: (val: boolean) => void;
  showPopDensity: boolean;
  onTogglePopDensity: (val: boolean) => void;
  showMigration: boolean;
  onToggleMigration: (val: boolean) => void;
  showChoropleth: boolean;
  onToggleChoropleth: (val: boolean) => void;
  choroplethIndicator: string;
  onChoroplethIndicatorChange: (val: string) => void;
  choroplethExaggeration: number;
  onChoroplethExaggerationChange: (val: number) => void;
  popHexSize: number;
  onPopHexSizeChange: (val: number) => void;
  popHexHeight: number;
  onPopHexHeightChange: (val: number) => void;
}

const Legend = ({ showBorders, onToggleBorders, showRivers, onToggleRivers, show13thBasin, onToggle13thBasin, show19thBasin, onToggle19thBasin, show21stBasin, onToggle21stBasin, showKhorezm, onToggleKhorezm, showWatershed, onToggleWatershed, showLandcover, onToggleLandcover, landcoverVisibleClasses, onLandcoverVisibleClassesChange, showLakes, onToggleLakes, show21cLakes, onToggle21cLakes, showPopDensity, onTogglePopDensity, popHexSize, onPopHexSizeChange, popHexHeight, onPopHexHeightChange, showMigration, onToggleMigration, showChoropleth, onToggleChoropleth, choroplethIndicator, onChoroplethIndicatorChange, choroplethExaggeration, onChoroplethExaggerationChange }: LegendProps) => {
  const [lcClasses, setLcClasses] = useState<number[]>([]);

  // Load landcover classes from the tif when landcover is shown
  useEffect(() => {
    if (!showLandcover || lcClasses.length > 0) return;
    (async () => {
      try {
        const resp = await fetch('/data/landcover.tif');
        const buf = await resp.arrayBuffer();
        const tiff = await fromArrayBuffer(buf);
        const image = await tiff.getImage();
        const fw = image.getWidth();
        const fh = image.getHeight();
        const maxDim = 256;
        const sx = Math.max(1, Math.ceil(fw / maxDim));
        const sy = Math.max(1, Math.ceil(fh / maxDim));
        const rasters = await image.readRasters({ width: Math.floor(fw / sx), height: Math.floor(fh / sy), resampleMethod: 'nearest' });
        const vals = rasters[0] as any;
        const unique = new Set<number>();
        for (let i = 0; i < vals.length; i++) {
          if (vals[i] !== 0) unique.add(vals[i]);
        }
        const sorted = Array.from(unique).sort((a, b) => a - b);
        setLcClasses(sorted);
      } catch {}
    })();
  }, [showLandcover]);

  const toggleLcClass = (cls: number) => {
    if (!onLandcoverVisibleClassesChange) return;
    if (!landcoverVisibleClasses) {
      // Currently showing all — hide this one
      const newSet = new Set(lcClasses);
      newSet.delete(cls);
      onLandcoverVisibleClassesChange(newSet);
    } else {
      const newSet = new Set(landcoverVisibleClasses);
      if (newSet.has(cls)) {
        newSet.delete(cls);
      } else {
        newSet.add(cls);
      }
      // If all are visible again, set to undefined (show all)
      if (newSet.size === lcClasses.length) {
        onLandcoverVisibleClassesChange(undefined);
      } else {
        onLandcoverVisibleClassesChange(newSet);
      }
    }
  };

  const isClassVisible = (cls: number) => {
    if (!landcoverVisibleClasses) return true;
    return landcoverVisibleClasses.has(cls);
  };

  const getClassColor = (cls: number): string => {
    return CLASS_COLORS[cls] || `hsl(${(cls * 137) % 360}, 60%, 50%)`;
  };

  return (
    <div className="glass-panel p-3 space-y-2 w-72 max-h-[60vh] overflow-y-auto">
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
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #2d6a4f, #95d5b2)' }} />
          Landcover
        </span>
        <Switch className="scale-75" checked={showLandcover} onCheckedChange={onToggleLandcover} />
      </label>

      {showLandcover && lcClasses.length > 0 && (
        <div className="ml-5 space-y-1 max-h-40 overflow-y-auto pr-1">
          {lcClasses.map(cls => (
            <label key={cls} className="flex items-center gap-2 cursor-pointer text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              <span
                className="inline-block w-3 h-3 rounded-sm flex-shrink-0 border border-white/20"
                style={{
                  background: getClassColor(cls),
                  opacity: isClassVisible(cls) ? 1 : 0.2,
                }}
                onClick={() => toggleLcClass(cls)}
              />
              <span
                className="truncate"
                style={{ opacity: isClassVisible(cls) ? 1 : 0.4 }}
                onClick={() => toggleLcClass(cls)}
              >
                {CLASS_NAMES[cls] || `Class ${cls}`}
              </span>
            </label>
          ))}
        </div>
      )}

      <label className="flex items-center justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #440154, #31688e, #35b779, #fde725)' }} />
          Population Density
        </span>
        <Switch className="scale-75" checked={showPopDensity} onCheckedChange={onTogglePopDensity} />
      </label>

      <label className="flex items-center justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #4caf50, #ff5722)' }} />
          Migration (Karakalpakstan)
        </span>
        <Switch className="scale-75" checked={showMigration} onCheckedChange={onToggleMigration} />
      </label>

      <label className="flex items-center justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, rgb(220,60,50), rgb(220,220,50), rgb(40,200,50))' }} />
          Demographics
        </span>
        <Switch className="scale-75" checked={showChoropleth} onCheckedChange={onToggleChoropleth} />
      </label>

      {showChoropleth && (
        <div className="ml-5 space-y-2">
          <Select value={choroplethIndicator} onValueChange={onChoroplethIndicatorChange}>
            <SelectTrigger className="h-7 text-[10px] bg-background/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INDICATORS.map(ind => (
                <SelectItem key={ind.id} value={ind.id} className="text-[11px]">
                  {ind.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-mono">
              Height: {choroplethExaggeration.toFixed(1)}×
            </label>
            <Slider
              value={[choroplethExaggeration]}
              onValueChange={(v) => onChoroplethExaggerationChange(v[0])}
              min={0}
              max={15}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>
      )}

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
