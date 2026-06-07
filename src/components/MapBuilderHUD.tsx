import { useEffect, useRef, useState } from 'react';
import { MAP_BUILDER_ITEMS, MapBuilderItemId, PlacedItem, getItemDef } from '@/lib/map-builder-items';
import { sfx } from '@/lib/ui-sfx';

interface Props {
  onExit: () => void;
  onPrev: () => void;
  /** Resolve a screen pixel into lat/lon on the terrain mesh. */
  getLatLonAtScreen?: (x: number, y: number) => { lat: number; lon: number } | null;
  /** Resolve the center aim into lat/lon (used by keyboard "X" placement). */
  getAimLatLon?: () => { lat: number; lon: number } | null;
  /** Push the latest placed-items list back up so the 3D scene can render it. */
  onItemsChange: (items: PlacedItem[]) => void;
}

let _uid = 0;
const nextId = () => `pl-${++_uid}-${Date.now().toString(36)}`;

const MapBuilderHUD = ({ onExit, onPrev, getLatLonAtScreen, getAimLatLon, onItemsChange }: Props) => {
  const [selected, setSelected] = useState<MapBuilderItemId>('water');
  const [items, setItems] = useState<PlacedItem[]>([]);
  const selectedRef = useRef(selected);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { onItemsChange(items); }, [items, onItemsChange]);

  const place = (lat: number, lon: number) => {
    setItems((prev) => [...prev, { id: nextId(), type: selectedRef.current, lat, lon }]);
    sfx.navNext?.();
  };

  // Click on terrain to place at that lat/lon.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('button, a, input, select, textarea, [data-hud]')) return;
      if (!getLatLonAtScreen) return;
      const ll = getLatLonAtScreen(e.clientX, e.clientY);
      if (!ll) return;
      place(ll.lat, ll.lon);
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getLatLonAtScreen]);

  // Keyboard: 1-9/0 selects palette, X places at center aim, Backspace undoes last.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1;
        if (MAP_BUILDER_ITEMS[idx]) { setSelected(MAP_BUILDER_ITEMS[idx].id); sfx.click(); }
        return;
      }
      if (e.key === '0' && MAP_BUILDER_ITEMS[9]) {
        setSelected(MAP_BUILDER_ITEMS[9].id); sfx.click(); return;
      }
      if (e.key === 'x' || e.key === 'X' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const ll = getAimLatLon?.();
        if (ll) place(ll.lat, ll.lon);
        return;
      }
      if (e.key === 'Backspace' || e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        setItems((prev) => prev.slice(0, -1));
        sfx.exit?.();
        return;
      }
      if (e.key === 'Escape') { onExit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAimLatLon]);

  return (
    <>
      {/* Top bar */}
      <div data-hud className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 rounded-md bg-black/60 backdrop-blur-md border border-white/15">
        <span className="text-white/90 font-mono text-[11px] tracking-wider uppercase">Level 5 · Map Builder</span>
        <span className="text-white/40 font-mono text-[10px]">click map to place · 1-9 to switch · X to drop at aim · Z to undo</span>
      </div>

      {/* Exit + Prev */}
      <button
        data-hud
        onClick={() => { sfx.exit(); onExit(); }}
        className="fixed top-4 right-4 z-40 px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md border border-white/15 text-white/90 font-mono text-[11px] hover:bg-black/80"
      >
        Exit
      </button>
      <button
        data-hud
        onClick={() => { sfx.navPrev(); onPrev(); }}
        className="fixed top-4 left-4 z-40 px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md border border-white/15 text-white/90 font-mono text-[11px] hover:bg-black/80"
      >
        ← Prev
      </button>

      {/* Counter */}
      <div data-hud className="fixed top-16 right-4 z-40 px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md border border-white/15 text-white/90 font-mono text-[11px]">
        Placed: <span className="text-white">{items.length}</span>
        {items.length > 0 && (
          <button
            onClick={() => { setItems([]); sfx.exit?.(); }}
            className="ml-3 underline text-white/60 hover:text-white"
          >clear</button>
        )}
      </div>

      {/* Hotbar / palette */}
      <div data-hud className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex gap-2 px-3 py-2 rounded-lg bg-black/70 backdrop-blur-md border border-white/15">
        {MAP_BUILDER_ITEMS.map((it, i) => {
          const isSel = selected === it.id;
          return (
            <button
              key={it.id}
              onClick={() => { setSelected(it.id); sfx.click(); }}
              className={`flex flex-col items-center justify-center w-14 h-16 rounded-md border-2 transition-all ${
                isSel
                  ? 'border-white bg-white/15 scale-105'
                  : 'border-white/15 bg-black/30 hover:border-white/40'
              }`}
              title={`${it.label} (${i < 9 ? i + 1 : 0})`}
            >
              <div className="text-2xl leading-none">{it.emoji}</div>
              <div className="text-[9px] mt-1 font-mono text-white/80 uppercase tracking-wider">{it.label}</div>
              <div className="text-[8px] font-mono text-white/40">{i < 9 ? i + 1 : 0}</div>
            </button>
          );
        })}
      </div>

      {/* Currently-selected label */}
      <div data-hud className="fixed bottom-28 left-1/2 -translate-x-1/2 z-40 px-3 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/15 text-white font-mono text-[11px]">
        Placing: {getItemDef(selected).emoji} <span className="uppercase tracking-wider">{getItemDef(selected).label}</span>
      </div>
    </>
  );
};

export default MapBuilderHUD;
