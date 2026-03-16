import { useState } from 'react';
import { Mission } from '@/lib/game-missions';
import { ChevronUp, ChevronDown, Settings } from 'lucide-react';

interface GameMissionHUDProps {
  currentMission: Mission | null;
  completedCount: number;
  totalCount: number;
  rewardMessage: string | null;
  rewardFact: string | null;
  waterPouringActive: boolean;
  onShowAllControls?: () => void;
}

export default function GameMissionHUD({
  currentMission,
  completedCount,
  totalCount,
  rewardMessage,
  rewardFact,
  waterPouringActive,
  onShowAllControls,
}: GameMissionHUDProps) {
  const [showHint, setShowHint] = useState(false);

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3 pointer-events-none max-w-xl w-full px-4">
      {/* Reward popup with fun fact */}
      {rewardMessage && (
        <div className="bg-card/95 backdrop-blur-lg border border-primary/40 px-6 py-5 rounded-xl animate-in fade-in slide-in-from-top-3 duration-500 pointer-events-auto shadow-lg">
          <p className="text-lg font-bold text-primary text-center mb-2">{rewardMessage}</p>
          {rewardFact && (
            <p className="text-sm text-foreground/80 leading-relaxed text-center max-w-md">
              📖 {rewardFact}
            </p>
          )}
        </div>
      )}

      {/* Current mission card */}
      {currentMission && !rewardMessage && (
        <div className="bg-card/95 backdrop-blur-lg border border-border/60 px-6 py-5 rounded-xl w-full pointer-events-auto shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{currentMission.emoji}</span>
              <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                Mission {currentMission.level} of {totalCount}
              </span>
            </div>
            {/* Progress dots */}
            <div className="flex gap-1">
              {Array.from({ length: totalCount }, (_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i < completedCount ? 'bg-primary' : i === completedCount ? 'bg-primary/50' : 'bg-muted-foreground/20'
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="text-lg font-bold text-foreground">{currentMission.title}</p>
          <p className="text-sm text-foreground/70 mt-1.5 leading-relaxed">{currentMission.description}</p>
          
          {/* Expandable hint */}
          <button
            onClick={() => setShowHint(v => !v)}
            className="flex items-center gap-1 mt-3 text-xs text-primary/80 hover:text-primary transition-colors"
          >
            💡 {showHint ? 'Hide hint' : 'Need a hint?'}
            {showHint ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showHint && (
            <p className="text-sm text-foreground/60 italic mt-1.5 animate-in fade-in duration-200">
              {currentMission.hint}
            </p>
          )}
        </div>
      )}

      {/* All done */}
      {completedCount === totalCount && totalCount > 0 && !rewardMessage && (
        <div className="bg-card/95 backdrop-blur-lg border border-primary/30 px-6 py-5 rounded-xl shadow-lg">
          <p className="text-lg font-bold text-primary text-center">🎉 All {totalCount} missions complete!</p>
          <p className="text-sm text-foreground/70 text-center mt-1.5">
            You've explored the entire Aral Sea region. The story of this place continues...
          </p>
        </div>
      )}

      {/* Controls bar */}
      <div className="bg-card/90 backdrop-blur-lg border border-border/40 px-5 py-2.5 rounded-xl flex items-center gap-5 pointer-events-auto shadow-md">
        <span className="text-xs text-foreground/70">
          <kbd className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-foreground text-xs">WASD</kbd>
          <span className="ml-1">Move</span>
        </span>
        <span className="text-xs text-foreground/70">
          <kbd className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-foreground text-xs">SPACE</kbd>
          <span className="ml-1">Pour water</span>
          {waterPouringActive && <span className="text-primary ml-1 font-bold animate-pulse">●</span>}
        </span>
        <span className="text-xs text-foreground/70">
          🖱️ <span className="ml-0.5">Rotate & Zoom</span>
        </span>
        <div className="h-3 w-px bg-border/50" />
        <span className="text-xs font-semibold text-foreground">
          {completedCount}/{totalCount}
        </span>
        {onShowAllControls && (
          <>
            <div className="h-3 w-px bg-border/50" />
            <button
              onClick={onShowAllControls}
              className="text-xs text-foreground/60 hover:text-primary transition-colors flex items-center gap-1"
            >
              <Settings className="w-3 h-3" />
              Controls
            </button>
          </>
        )}
      </div>
    </div>
  );
}
