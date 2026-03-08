import { useState, useCallback, useMemo, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Dam, X, Droplets, Ruler, Waves, Mountain } from 'lucide-react';
import { TerrainData } from '@/lib/geotiff-loader';
import { simulateReservoir, ReservoirResult } from '@/lib/dam-simulation';

interface DamToolPanelProps {
  terrain: TerrainData;
  active: boolean;
  onToggle: () => void;
  damPosition: { lat: number; lon: number } | null;
  onSimulationResult: (result: ReservoirResult | null) => void;
  onClear: () => void;
}

const DamToolPanel = ({
  terrain,
  active,
  onToggle,
  damPosition,
  onSimulationResult,
  onClear,
}: DamToolPanelProps) => {
  const [damHeight, setDamHeight] = useState(20);
  const [damWidth, setDamWidth] = useState(500);
  const [result, setResult] = useState<ReservoirResult | null>(null);

  // Run simulation when position or parameters change
  useEffect(() => {
    if (!damPosition || !active) {
      setResult(null);
      onSimulationResult(null);
      return;
    }

    const timer = setTimeout(() => {
      const res = simulateReservoir(
        terrain,
        damPosition.lat,
        damPosition.lon,
        damHeight,
        damWidth
      );
      setResult(res);
      onSimulationResult(res);
    }, 100); // debounce

    return () => clearTimeout(timer);
  }, [damPosition, damHeight, damWidth, terrain, active, onSimulationResult]);

  const handleClear = useCallback(() => {
    setResult(null);
    onSimulationResult(null);
    onClear();
  }, [onSimulationResult, onClear]);

  return (
    <div className="glass-panel w-72 overflow-hidden">
      <button
        onClick={onToggle}
        className={`w-full p-2.5 flex items-center justify-center gap-2 text-xs transition-colors cursor-pointer ${
          active
            ? 'text-foreground bg-primary/10 ring-1 ring-primary/30'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Waves className="w-3.5 h-3.5" />
        {active ? 'Dam Tool Active' : 'Dam Simulation Tool'}
      </button>

      {active && (
        <div className="p-3 space-y-3 border-t border-border/50">
          {!damPosition ? (
            <p className="text-xs text-muted-foreground text-center">
              Click on the terrain to place a dam
            </p>
          ) : (
            <>
              <div className="text-xs text-muted-foreground">
                Dam at {damPosition.lat.toFixed(3)}°N, {damPosition.lon.toFixed(3)}°E
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mountain className="w-3 h-3" /> Height
                  </label>
                  <span className="text-xs font-mono text-foreground">{damHeight} m</span>
                </div>
                <Slider
                  value={[damHeight]}
                  onValueChange={([v]) => setDamHeight(v)}
                  min={5}
                  max={80}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Ruler className="w-3 h-3" /> Width
                  </label>
                  <span className="text-xs font-mono text-foreground">{damWidth} m</span>
                </div>
                <Slider
                  value={[damWidth]}
                  onValueChange={([v]) => setDamWidth(v)}
                  min={50}
                  max={2000}
                  step={50}
                  className="w-full"
                />
              </div>

              {result && (
                <div className="rounded-md bg-primary/5 border border-primary/20 p-2.5 space-y-1.5">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-primary" />
                    Reservoir Statistics
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <div className="text-xs text-muted-foreground">Volume:</div>
                    <div className="text-xs font-mono text-foreground">{result.volume.toFixed(3)} km³</div>
                    <div className="text-xs text-muted-foreground">Surface:</div>
                    <div className="text-xs font-mono text-foreground">{result.surfaceArea.toFixed(1)} km²</div>
                    <div className="text-xs text-muted-foreground">Max Depth:</div>
                    <div className="text-xs font-mono text-foreground">{result.maxDepth.toFixed(1)} m</div>
                    <div className="text-xs text-muted-foreground">Crest:</div>
                    <div className="text-xs font-mono text-foreground">{result.crestElevation.toFixed(1)} m</div>
                  </div>
                </div>
              )}

              {!result && damPosition && (
                <p className="text-xs text-muted-foreground/70 text-center italic">
                  No reservoir formed — terrain may be too flat or elevated
                </p>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="w-full text-xs"
              >
                <X className="w-3 h-3 mr-1" /> Clear Dam
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DamToolPanel;
