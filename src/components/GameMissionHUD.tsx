import { Mission } from '@/lib/game-missions';

interface GameMissionHUDProps {
  currentMission: Mission | null;
  completedCount: number;
  totalCount: number;
  rewardMessage: string | null;
  collectMessage: string | null;
  waterPouringActive: boolean;
}

export default function GameMissionHUD({
  currentMission,
  completedCount,
  totalCount,
  rewardMessage,
  collectMessage,
  waterPouringActive,
}: GameMissionHUDProps) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none">
      {/* Reward popup */}
      {rewardMessage && (
        <div className="bg-primary/20 backdrop-blur-md border border-primary/40 px-5 py-2.5 rounded-lg animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="text-sm font-bold text-primary text-center">{rewardMessage}</p>
        </div>
      )}

      {/* Collect popup */}
      {collectMessage && (
        <div className="bg-accent/20 backdrop-blur-md border border-accent/40 px-4 py-1.5 rounded-lg">
          <p className="text-xs font-semibold text-accent-foreground">✨ {collectMessage} collected!</p>
        </div>
      )}

      {/* Current mission card */}
      {currentMission && !rewardMessage && (
        <div className="bg-card/85 backdrop-blur-md border border-border/60 px-5 py-3 rounded-lg max-w-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{currentMission.emoji}</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
              Level {currentMission.level}/{totalCount}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground">{currentMission.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{currentMission.description}</p>
          <p className="text-[10px] text-muted-foreground/70 italic mt-1">💡 {currentMission.hint}</p>
        </div>
      )}

      {/* All done */}
      {completedCount === totalCount && totalCount > 0 && !rewardMessage && (
        <div className="bg-primary/15 backdrop-blur-md border border-primary/30 px-5 py-3 rounded-lg">
          <p className="text-sm font-bold text-primary text-center">🎉 All missions complete!</p>
          <p className="text-[10px] text-muted-foreground text-center mt-1">You've explored the entire region.</p>
        </div>
      )}

      {/* Controls hint */}
      <div className="bg-card/70 backdrop-blur-sm border border-border/40 px-4 py-1.5 rounded flex items-center gap-4">
        <span className="text-[10px] text-muted-foreground tracking-wide">
          <kbd className="font-mono bg-muted/50 px-1 rounded text-foreground">WASD</kbd> Move
        </span>
        <span className="text-[10px] text-muted-foreground tracking-wide">
          <kbd className="font-mono bg-muted/50 px-1 rounded text-foreground">SPACE</kbd> Pour water
          {waterPouringActive && <span className="text-primary ml-1 font-bold">●</span>}
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">
          {completedCount}/{totalCount} ✓
        </span>
      </div>
    </div>
  );
}
