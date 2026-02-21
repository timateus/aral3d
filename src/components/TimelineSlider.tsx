import { useState, useEffect, useRef, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Play, Pause } from 'lucide-react';

interface TimelineSliderProps {
  year: number;
  onYearChange: (year: number) => void;
  visible: boolean;
  onToggleVisible: (val: boolean) => void;
  interpolate?: boolean;
  onToggleInterpolate?: (val: boolean) => void;
}

const MIN_YEAR = 1974;
const MAX_YEAR = 2015;

const TimelineSlider = ({ year, onYearChange, visible, onToggleVisible, interpolate, onToggleInterpolate }: TimelineSliderProps) => {
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    setPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const play = useCallback(() => {
    if (!visible) onToggleVisible(true);
    setPlaying(true);
    // Reset to start if at end
    if (year >= MAX_YEAR) onYearChange(MIN_YEAR);
  }, [year, visible, onToggleVisible, onYearChange]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      onYearChange(year + 1);
    }, 150);
    return () => clearInterval(id);
  }, [playing, year, onYearChange]);

  useEffect(() => {
    if (playing && year >= MAX_YEAR) stop();
  }, [year, playing, stop]);

  return (
    <div className="glass-panel p-3 space-y-2 w-72">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground font-mono">
          Water Extent: {year}
        </label>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { if (!visible) onToggleVisible(true); else onToggleVisible(false); }}
            className={`text-[10px] px-1.5 py-0.5 rounded ${visible ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'} transition-colors`}
          >
            {visible ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => playing ? stop() : play()}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
        </div>
      </div>
      <Slider
        value={[year]}
        onValueChange={(v) => { stop(); onYearChange(v[0]); if (!visible) onToggleVisible(true); }}
        min={MIN_YEAR}
        max={MAX_YEAR}
        step={1}
        className="w-full"
      />
      <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
        <span>{MIN_YEAR}</span>
        <span>{MAX_YEAR}</span>
      </div>
      {onToggleInterpolate && (
        <label className="flex items-center gap-2 cursor-pointer pt-1">
          <Checkbox
            checked={interpolate}
            onCheckedChange={(v) => onToggleInterpolate(!!v)}
            className="h-3.5 w-3.5"
          />
          <span className="text-[10px] text-muted-foreground">Interpolate boundaries</span>
        </label>
      )}
    </div>
  );
};

export default TimelineSlider;
