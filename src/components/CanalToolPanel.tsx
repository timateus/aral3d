import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Shovel, X, ArrowDown, Eye, EyeOff } from 'lucide-react';

interface CanalToolPanelProps {
  active: boolean;
  onToggle: () => void;
  onClear: () => void;
  brushRadius: number;
  onBrushRadiusChange: (v: number) => void;
  digDepth: number;
  onDigDepthChange: (v: number) => void;
  editCount: number;
  digEnabled: boolean;
  onToggleDig: () => void;
}

const CanalToolPanel = ({
  active,
  onToggle,
  onClear,
  brushRadius,
  onBrushRadiusChange,
  digDepth,
  onDigDepthChange,
  editCount,
  digEnabled,
  onToggleDig,
}: CanalToolPanelProps) => {
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
        <Shovel className="w-3.5 h-3.5" />
        {active ? 'Dig Canal Active' : 'Dig Canal Tool'}
      </button>

      {active && (
        <div className="p-3 space-y-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground text-center">
            Click and drag on the terrain to dig a canal. Use with Water Flow to see water fill the canal.
          </p>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowDown className="w-3 h-3" /> Dig Depth
              </label>
              <span className="text-xs font-mono text-foreground">{digDepth} m</span>
            </div>
            <Slider
              value={[digDepth]}
              onValueChange={([v]) => onDigDepthChange(v)}
              min={1}
              max={50}
              step={1}
              className="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Shovel className="w-3 h-3" /> Brush Width
              </label>
              <span className="text-xs font-mono text-foreground">{brushRadius} px</span>
            </div>
            <Slider
              value={[brushRadius]}
              onValueChange={([v]) => onBrushRadiusChange(v)}
              min={1}
              max={15}
              step={1}
              className="w-full"
            />
          </div>

          {editCount > 0 && (
            <>
              <div className="flex items-center justify-between rounded-md bg-accent/30 p-2">
                <label className="text-xs text-foreground flex items-center gap-1.5">
                  {digEnabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  Show dug canal
                </label>
                <Switch
                  checked={digEnabled}
                  onCheckedChange={onToggleDig}
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#00b4d8' }} />
                {editCount} edit{editCount !== 1 ? 's' : ''} · {digEnabled ? 'Enabled' : 'Disabled'}
              </div>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="w-full text-xs"
            disabled={editCount === 0}
          >
            <X className="w-3 h-3 mr-1" /> Reset Canal
          </Button>
        </div>
      )}
    </div>
  );
};

export default CanalToolPanel;
