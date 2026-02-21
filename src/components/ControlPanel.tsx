import { TerrainData } from '@/lib/geotiff-loader';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DataSource } from '@/pages/Index';

interface ControlPanelProps {
  terrain: TerrainData | null;
  exaggeration: number;
  onExaggerationChange: (val: number) => void;
  waterLevel: number;
  onWaterLevelChange: (val: number) => void;
  loading: boolean;
  dataSource: DataSource;
  onDataSourceChange: (val: DataSource) => void;
  hasSeabed: boolean;
}

const ControlPanel = ({ terrain, exaggeration, onExaggerationChange, waterLevel, onWaterLevelChange, loading, dataSource, onDataSourceChange, hasSeabed }: ControlPanelProps) => {
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

      {hasSeabed && (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground font-mono">
            Data Source
          </label>
          <Select value={dataSource} onValueChange={(v) => onDataSourceChange(v as DataSource)}>
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="regional">Regional DEM only</SelectItem>
              <SelectItem value="seabed">Seabed DEM only</SelectItem>
              <SelectItem value="merged">Merged (seabed priority)</SelectItem>
            </SelectContent>
          </Select>
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
              max={30}
              step={1}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-mono">
              Water Level: {waterLevel} m
            </label>
            <Slider
              value={[waterLevel]}
              onValueChange={(v) => onWaterLevelChange(v[0])}
              min={-10}
              max={100}
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

    </div>
  );
};

export default ControlPanel;
