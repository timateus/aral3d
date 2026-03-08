import { useState, useCallback, useEffect, useRef } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Droplets, X, Play, Pause, RotateCcw, Zap } from 'lucide-react';

interface WaterFlowPanelProps {
  active: boolean;
  onToggle: () => void;
  isPlaced: boolean;
  stepCount: number;
  wetPixelCount: number;
  isAnimating: boolean;
  onToggleAnimate: () => void;
  onStep: () => void;
  onReset: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  waterAmount: number;
  onWaterAmountChange: (amount: number) => void;
}

const WaterFlowPanel = ({
  active,
  onToggle,
  isPlaced,
  stepCount,
  wetPixelCount,
  isAnimating,
  onToggleAnimate,
  onStep,
  onReset,
  speed,
  onSpeedChange,
  waterAmount,
  onWaterAmountChange,
}: WaterFlowPanelProps) => {
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
        <Droplets className="w-3.5 h-3.5" />
        {active ? 'Water Flow Active' : 'Water Flow Tool'}
      </button>

      {active && (
        <div className="p-3 space-y-3 border-t border-border/50">
          {!isPlaced ? (
            <p className="text-xs text-muted-foreground text-center">
              Click on the terrain to pour water
            </p>
          ) : (
            <>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleAnimate}
                  className="flex-1 text-xs"
                >
                  {isAnimating ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                  {isAnimating ? 'Pause' : 'Play'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onStep}
                  disabled={isAnimating}
                  className="flex-1 text-xs"
                >
                  <Zap className="w-3 h-3 mr-1" /> Step
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onReset}
                  className="text-xs px-2"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">Speed</label>
                  <span className="text-xs font-mono text-foreground">{speed}x</span>
                </div>
                <Slider
                  value={[speed]}
                  onValueChange={([v]) => onSpeedChange(v)}
                  min={1}
                  max={300}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">Water amount</label>
                  <span className="text-xs font-mono text-foreground">{waterAmount}</span>
                </div>
                <Slider
                  value={[waterAmount]}
                  onValueChange={([v]) => onWaterAmountChange(v)}
                  min={1}
                  max={20}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="rounded-md bg-primary/5 border border-primary/20 p-2.5 space-y-1">
                <div className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-primary" />
                  Flow Stats
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div className="text-xs text-muted-foreground">Steps:</div>
                  <div className="text-xs font-mono text-foreground">{stepCount}</div>
                  <div className="text-xs text-muted-foreground">Wet pixels:</div>
                  <div className="text-xs font-mono text-foreground">{wetPixelCount.toLocaleString()}</div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground/70 text-center italic">
                Click again to add more water
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default WaterFlowPanel;
