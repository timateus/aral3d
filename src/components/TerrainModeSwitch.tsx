import { useState } from 'react';
import { useTerrainMode } from '@/hooks/useTerrainMode';

const TerrainModeSwitch = () => {
  const { mode, setMode, token, setToken } = useTerrainMode();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(token);

  const handleSatelliteClick = () => {
    if (!token) {
      setEditing(true);
      return;
    }
    setMode('satellite');
  };

  return (
    <div className="border-t border-white/10 pt-2 mt-2 space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-mono">
        Terrain Source
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => setMode('classic')}
          className={`flex-1 px-2 py-1 text-[10px] font-mono uppercase tracking-wider border transition-colors ${
            mode === 'classic'
              ? 'bg-white/10 border-white/30 text-white'
              : 'bg-transparent border-white/10 text-muted-foreground hover:text-white'
          }`}
        >
          Classic
        </button>
        <button
          onClick={handleSatelliteClick}
          className={`flex-1 px-2 py-1 text-[10px] font-mono uppercase tracking-wider border transition-colors ${
            mode === 'satellite'
              ? 'bg-white/10 border-white/30 text-white'
              : 'bg-transparent border-white/10 text-muted-foreground hover:text-white'
          }`}
        >
          Satellite
        </button>
      </div>

      {mode === 'satellite' && !editing && (
        <button
          onClick={() => { setDraft(token); setEditing(true); }}
          className="text-[10px] text-muted-foreground hover:text-white underline underline-offset-2"
        >
          Edit Mapbox token
        </button>
      )}

      {editing && (
        <div className="space-y-1">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="pk.eyJ..."
            className="w-full px-2 py-1 text-[10px] font-mono bg-black/40 border border-white/20 text-white focus:outline-none focus:border-white/40"
          />
          <div className="flex gap-1">
            <button
              onClick={() => {
                setToken(draft);
                setEditing(false);
                if (draft.trim()) setMode('satellite');
              }}
              className="flex-1 px-2 py-1 text-[10px] font-mono uppercase bg-white/10 border border-white/30 text-white hover:bg-white/20"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-2 py-1 text-[10px] font-mono uppercase border border-white/10 text-muted-foreground hover:text-white"
            >
              Cancel
            </button>
          </div>
          <a
            href="https://account.mapbox.com/access-tokens/"
            target="_blank"
            rel="noreferrer"
            className="text-[9px] text-muted-foreground/70 hover:text-white underline underline-offset-2"
          >
            Get a free Mapbox public token →
          </a>
        </div>
      )}
    </div>
  );
};

export default TerrainModeSwitch;
