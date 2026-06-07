import { useEffect, useRef, useState } from 'react';
import { MAP_BUILDER_ITEMS, MapBuilderItemId, PlacedItem, getItemDef } from '@/lib/map-builder-items';
import { sfx } from '@/lib/ui-sfx';
import { useGamepad } from '@/hooks/useGamepad';

interface Props {
  onExit: () => void;
  onPrev: () => void;
  /** Resolve the center aim into lat/lon (used for placement under crosshair). */
  getAimLatLon?: () => { lat: number; lon: number } | null;
  /** Push the latest placed-items list up so the 3D scene can render it. */
  onItemsChange: (items: PlacedItem[]) => void;
}

let _uid = 0;
const nextId = () => `pl-${++_uid}-${Date.now().toString(36)}`;
const PLACE_INTERVAL_MS = 120;

const MapBuilderHUD = ({ onExit, onPrev, getAimLatLon, onItemsChange }: Props) => {
  const [selected, setSelected] = useState<MapBuilderItemId>('water');
  const [items, setItems] = useState<PlacedItem[]>([]);
  const selectedRef = useRef(selected);
  const itemsRef = useRef(items);
  const heldRef = useRef(false);
  const { stateRef: gpRef } = useGamepad();
  const prevBumpers = useRef({ lb: false, rb: false });

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { itemsRef.current = items; onItemsChange(items); }, [items, onItemsChange]);

  const place = () => {
    const ll = getAimLatLon?.();
    if (!ll) return;
    setItems((prev) => [...prev, { id: nextId(), type: selectedRef.current, lat: ll.lat, lon: ll.lon }]);
  };

  // Continuous-place loop while held.
  useEffect(() => {
    const t = setInterval(() => {
      if (heldRef.current) place();
    }, PLACE_INTERVAL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger sources: window mouse/keyboard (FPS controller also listens, but we mirror so HUD owns the timer).
  useEffect(() => {
    const setHeld = (v: boolean) => { heldRef.current = v; };
    const dn = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      if (e.key === ' ' || e.key === 'x' || e.key === 'X' || e.key === 'Enter') {
        e.preventDefault();
        setHeld(true);
      }
      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1;
        if (MAP_BUILDER_ITEMS[idx]) { setSelected(MAP_BUILDER_ITEMS[idx].id); sfx.click(); }
      } else if (e.key === '0' && MAP_BUILDER_ITEMS[9]) {
        setSelected(MAP_BUILDER_ITEMS[9].id); sfx.click();
      } else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') {
        e.preventDefault();
        setItems((prev) => prev.slice(0, -1));
        sfx.exit?.();
      } else if (e.key === 'Escape') {
        if (document.pointerLockElement) (document as any).exitPointerLock?.();
        else onExit();
      } else if (e.key === '[' || e.key === ',') {
        // cycle palette left
        const i = MAP_BUILDER_ITEMS.findIndex((x) => x.id === selectedRef.current);
        const n = (i - 1 + MAP_BUILDER_ITEMS.length) % MAP_BUILDER_ITEMS.length;
        setSelected(MAP_BUILDER_ITEMS[n].id); sfx.click();
      } else if (e.key === ']' || e.key === '.') {
        const i = MAP_BUILDER_ITEMS.findIndex((x) => x.id === selectedRef.current);
        const n = (i + 1) % MAP_BUILDER_ITEMS.length;
        setSelected(MAP_BUILDER_ITEMS[n].id); sfx.click();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'x' || e.key === 'X' || e.key === 'Enter') setHeld(false);
    };
    const md = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest('[data-hud], button, a, input, select, textarea')) return;
      if (e.button === 0) setHeld(true);
    };
    const mu = (e: MouseEvent) => { if (e.button === 0) setHeld(false); };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    window.addEventListener('mousedown', md);
    window.addEventListener('mouseup', mu);
    return () => {
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
      window.removeEventListener('mousedown', md);
      window.removeEventListener('mouseup', mu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gamepad polling loop: A/RT = place, LB/RB = cycle palette, Y = undo, B = exit.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const gp = gpRef.current;
      if (gp.connected) {
        heldRef.current = heldRef.current || gp.buttons.a || gp.buttons.rt > 0.4;
        // edge: bumpers
        if (gp.buttons.rb && !prevBumpers.current.rb) {
          const i = MAP_BUILDER_ITEMS.findIndex((x) => x.id === selectedRef.current);
          setSelected(MAP_BUILDER_ITEMS[(i + 1) % MAP_BUILDER_ITEMS.length].id);
          sfx.click();
        }
        if (gp.buttons.lb && !prevBumpers.current.lb) {
          const i = MAP_BUILDER_ITEMS.findIndex((x) => x.id === selectedRef.current);
          setSelected(MAP_BUILDER_ITEMS[(i - 1 + MAP_BUILDER_ITEMS.length) % MAP_BUILDER_ITEMS.length].id);
          sfx.click();
        }
        prevBumpers.current.lb = gp.buttons.lb;
        prevBumpers.current.rb = gp.buttons.rb;
        // When neither place button held → release.
        if (!gp.buttons.a && gp.buttons.rt <= 0.4 && !isKeyboardOrMouseHeld()) {
          heldRef.current = false;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // helper: re-check window-mouse / key state via the latest heldRef would loop; just mirror state.
  // The keyboard/mouse handlers above already set heldRef directly; we only need to make sure
  // the gamepad branch doesn't *reset* a key/mouse-held state. Track it via a tiny flag:
  const kbMouseHeld = useRef(false);
  useEffect(() => {
    const set = (v: boolean) => { kbMouseHeld.current = v; };
    const dn = (e: KeyboardEvent) => { if (['x','X',' ','Enter'].includes(e.key)) set(true); };
    const up = (e: KeyboardEvent) => { if (['x','X',' ','Enter'].includes(e.key)) set(false); };
    const md = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest('[data-hud], button, a, input, select, textarea')) return;
      if (e.button === 0) set(true);
    };
    const mu = (e: MouseEvent) => { if (e.button === 0) set(false); };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    window.addEventListener('mousedown', md);
    window.addEventListener('mouseup', mu);
    return () => {
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
      window.removeEventListener('mousedown', md);
      window.removeEventListener('mouseup', mu);
    };
  }, []);
  function isKeyboardOrMouseHeld() { return kbMouseHeld.current; }

  return (
    <>
      {/* Crosshair */}
      <div
        data-hud
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
        style={{ width: 18, height: 18 }}
      >
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-px h-full bg-white/80 mix-blend-difference" />
        <div className="absolute top-1/2 left-0 -translate-y-1/2 h-px w-full bg-white/80 mix-blend-difference" />
      </div>

      {/* Top bar */}
      <div data-hud className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 rounded-md bg-black/60 backdrop-blur-md border border-white/15">
        <span className="text-white/90 font-mono text-[11px] tracking-wider uppercase">Level 5 · Map Builder</span>
        <span className="text-white/40 font-mono text-[10px]">WASD walk · mouse / R-stick look · hold X / A / click to place · 1–9 swap · Z undo</span>
      </div>

      {/* Prev / Exit */}
      <button
        data-hud
        onClick={() => { sfx.navPrev(); onPrev(); }}
        className="fixed top-4 left-4 z-40 px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md border border-white/15 text-white/90 font-mono text-[11px] hover:bg-black/80"
      >
        ← Prev
      </button>
      <button
        data-hud
        onClick={() => { sfx.exit(); onExit(); }}
        className="fixed top-4 right-4 z-40 px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md border border-white/15 text-white/90 font-mono text-[11px] hover:bg-black/80"
      >
        Exit
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
              <div
                className="w-7 h-7 rounded-sm border border-white/30"
                style={{ background: it.color, boxShadow: `0 0 8px ${it.color}66` }}
              />
              <div className="text-[9px] mt-1 font-mono text-white/80 uppercase tracking-wider">{it.label}</div>
              <div className="text-[8px] font-mono text-white/40">{i < 9 ? i + 1 : 0}</div>
            </button>
          );
        })}
      </div>

      {/* Currently-selected label */}
      <div data-hud className="fixed bottom-28 left-1/2 -translate-x-1/2 z-40 px-3 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/15 text-white font-mono text-[11px]">
        Placing: <span className="uppercase tracking-wider">{getItemDef(selected).label}</span>
      </div>
    </>
  );
};

export default MapBuilderHUD;
