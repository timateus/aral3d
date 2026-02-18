import { TerrainData } from '@/lib/geotiff-loader';
import { Slider } from '@/components/ui/slider';

interface ControlPanelProps {
  terrain: TerrainData | null;
  exaggeration: number;
  onExaggerationChange: (val: number) => void;
  loading: boolean;
}

const ControlPanel = ({ terrain, exaggeration, onExaggerationChange, loading }: ControlPanelProps) => {
  return (
    <div className="glass-panel p-4 space-y-4 w-72">
      <h2 className="text-sm font-semibold text-foreground tracking-wide uppercase">
        Terrain Controls
      </h2>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
          Loading DEM data…
        </div>
      )}

      {terrain && (
        <>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-mono">
              Vertical Exaggeration: {exaggeration.toFixed(1)}x
            </label>
            <Slider
              value={[exaggeration]}
              onValueChange={(v) => onExaggerationChange(v[0])}
              min={1}
              max={500}
              step={1}
              className="w-full"
            />
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground font-mono">
              Resolution: {terrain.width} × {terrain.height}
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              Min Elev: {terrain.minElevation.toFixed(1)} m
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              Max Elev: {terrain.maxElevation.toFixed(1)} m
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              Range: {(terrain.maxElevation - terrain.minElevation).toFixed(1)} m
            </p>
          </div>
        </>
      )}

      <div className="pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
        <p>🖱️ Left drag: rotate</p>
        <p>🖱️ Right drag: pan</p>
        <p>🖱️ Scroll: zoom</p>
      </div>
    </div>
  );
};

export default ControlPanel;
