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
    <>
      {/* Mission card — compact, top-left */}
      <div className="absolute top-16 left-4 z-20 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {/* Reward popup */}
        {rewardMessage && (
          <div className="bg-card/95 backdrop-blur-lg border border-primary/40 px-4 py-3 animate-in fade-in slide-in-from-top-3 duration-500 pointer-events-auto shadow-lg">
            <p className="text-sm font-bold text-primary mb-1">{rewardMessage}</p>
            {rewardFact && (
              <p className="text-xs text-foreground/80 leading-relaxed">
                📖 {rewardFact}
              </p>
            )}
          </div>
        )}

        {/* Current mission */}
        {currentMission && !rewardMessage && (
          <div className="bg-card/95 backdrop-blur-lg border border-border/60 px-4 py-3 pointer-events-auto shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{currentMission.emoji}</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                {completedCount + 1}/{totalCount}
              </span>
            </div>
            <p className="text-sm font-bold text-foreground">{currentMission.title}</p>
            <p className="text-xs text-foreground/70 mt-0.5 leading-relaxed">{currentMission.description}</p>
            
            <button
              onClick={() => setShowHint(v => !v)}
              className="flex items-center gap-1 mt-2 text-[10px] text-primary/80 hover:text-primary transition-colors"
            >
              💡 {showHint ? 'Hide' : 'Hint'}
              {showHint ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showHint && (
              <p className="text-xs text-foreground/60 italic mt-1 animate-in fade-in duration-200">
                {currentMission.hint}
              </p>
            )}
          </div>
        )}

        {/* All done */}
        {completedCount === totalCount && totalCount > 0 && !rewardMessage && (
          <div className="bg-card/95 backdrop-blur-lg border border-primary/30 px-4 py-3 shadow-lg">
            <p className="text-sm font-bold text-primary">🎉 All {totalCount} missions complete!</p>
            <p className="text-xs text-foreground/70 mt-0.5">
              You've explored the entire Aral Sea region.
            </p>
          </div>
        )}
      </div>

      {/* Controls — right side, vertical */}
      <div className="absolute top-16 right-4 z-20 pointer-events-auto">
        <div className="bg-card/90 backdrop-blur-lg border border-border/40 px-3 py-3 shadow-md flex flex-col gap-2 text-xs text-foreground/70 w-40">
          <div className="flex items-center gap-2">
            <kbd className="font-mono bg-muted/60 px-1.5 py-0.5 text-foreground text-[10px]">WASD</kbd>
            <span>Move</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="font-mono bg-muted/60 px-1.5 py-0.5 text-foreground text-[10px]">SPACE</kbd>
            <span>Pour water</span>
            {waterPouringActive && <span className="text-primary font-bold animate-pulse">●</span>}
          </div>
          <div className="flex items-center gap-2">
            <span>🖱️</span>
            <span>Rotate & Zoom</span>
          </div>
          <div className="h-px bg-border/50" />
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">
              Progress: {completedCount}/{totalCount}
            </span>
          </div>
          {onShowAllControls && (
            <button
              onClick={onShowAllControls}
              className="text-[10px] text-foreground/60 hover:text-primary transition-colors flex items-center gap-1 mt-1"
            >
              <Settings className="w-3 h-3" />
              All Controls
            </button>
          )}
        </div>
      </div>
    </>
  );
}
