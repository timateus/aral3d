import { useState, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Mountain, X, ArrowUp } from 'lucide-react';

interface DamToolPanelProps {
  active: boolean;
  onToggle: () => void;
  onClear: () => void;
  brushRadius: number;
  onBrushRadiusChange: (v: number) => void;
  raiseAmount: number;
  onRaiseAmountChange: (v: number) => void;
  editCount: number;
}

const DamToolPanel = ({
  active,
  onToggle,
  onClear,
  brushRadius,
  onBrushRadiusChange,
  raiseAmount,
  onRaiseAmountChange,
  editCount,
}: DamToolPanelProps) => {
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
        <Mountain className="w-3.5 h-3.5" />
        {active ? 'Raise Terrain Active' : 'Raise Terrain Tool'}
      </button>

      {active && (
        <div className="p-3 space-y-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground text-center">
            Click on the terrain to raise elevation. Use with Water Flow to test where water accumulates.
          </p>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowUp className="w-3 h-3" /> Raise Amount
              </label>
              <span className="text-xs font-mono text-foreground">{raiseAmount} m</span>
            </div>
            <Slider
              value={[raiseAmount]}
              onValueChange={([v]) => onRaiseAmountChange(v)}
              min={1}
              max={50}
              step={1}
              className="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Mountain className="w-3 h-3" /> Brush Radius
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
            <div className="text-xs text-muted-foreground text-center">
              {editCount} edit{editCount !== 1 ? 's' : ''} applied
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="w-full text-xs"
            disabled={editCount === 0}
          >
            <X className="w-3 h-3 mr-1" /> Reset Terrain
          </Button>
        </div>
      )}
    </div>
  );
};

export default DamToolPanel;
