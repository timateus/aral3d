import { useEffect, useRef, useState } from 'react';
import {
  PALETTE_ITEMS,
  MapBuilderItemId,
  PlacedItem,
  getItemDef,
  snapLatLon,
  cellKey,
  CELL_DEG,
} from '@/lib/map-builder-items';
import { firstPersonBridge } from '@/lib/first-person-bridge';
import { sfx } from '@/lib/ui-sfx';
import { useGamepad } from '@/hooks/useGamepad';

interface Props {
  onExit: () => void;
  onPrev: () => void;
  /** Optional override; defaults to the "in-front-of-camera" aim from FPC. */
  getAimLatLon?: () => { lat: number; lon: number } | null;
  onItemsChange: (items: PlacedItem[]) => void;
}

let _uid = 0;
const nextId = () => `pl-${++_uid}-${Date.now().toString(36)}`;
const PLACE_INTERVAL_MS = 140;
const SIM_TICK_MS = 600;
const FLAMMABLE: MapBuilderItemId[] = ['seed', 'plant', 'saxaul', 'reed', 'oil'];

const MapBuilderHUD = ({ onExit, onPrev, getAimLatLon, onItemsChange }: Props) => {
  const [selected, setSelected] = useState<MapBuilderItemId>('water');
  const [items, setItems] = useState<PlacedItem[]>([]);
  const selectedRef = useRef(selected);
  const itemsRef = useRef(items);
  const heldRef = useRef(false);
  const { stateRef: gpRef } = useGamepad();
  const prevBumpers = useRef({ lb: false, rb: false });
  const kbMouseHeld = useRef(false);

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => {
    itemsRef.current = items;
    firstPersonBridge.placedItems = items;
    onItemsChange(items);
  }, [items, onItemsChange]);

  const readAim = (): { lat: number; lon: number } | null => {
    if (getAimLatLon) {
      const a = getAimLatLon();
      if (a) return a;
    }
    return firstPersonBridge.aim;
  };

  const place = () => {
    const ll = readAim();
    if (!ll) return;
    const snapped = snapLatLon(ll.lat, ll.lon);
    const key = cellKey(snapped.lat, snapped.lon);
    const def = getItemDef(selectedRef.current);
    const stack = def.kind === 'block'
      ? itemsRef.current.filter((it) => getItemDef(it.type).kind === 'block' && cellKey(it.lat, it.lon) === key).length
      : 0;
    setItems((prev) => [...prev, { id: nextId(), type: selectedRef.current, lat: snapped.lat, lon: snapped.lon, stack }]);
  };

  // Continuous-place loop while held
  useEffect(() => {
    const t = setInterval(() => { if (heldRef.current) place(); }, PLACE_INTERVAL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Sandspiel-style simulation tick -----
  useEffect(() => {
    const tick = setInterval(() => {
      setItems((prev) => {
        // Group by cell
        const cells = new Map<string, PlacedItem[]>();
        for (const it of prev) {
          const k = cellKey(it.lat, it.lon);
          let arr = cells.get(k);
          if (!arr) { arr = []; cells.set(k, arr); }
          arr.push(it);
        }
        const hasTypeAround = (lat: number, lon: number, type: MapBuilderItemId) => {
          for (const dla of [-CELL_DEG, 0, CELL_DEG]) {
            for (const dlo of [-CELL_DEG, 0, CELL_DEG]) {
              const arr = cells.get(cellKey(lat + dla, lon + dlo));
              if (arr?.some((x) => x.type === type)) return true;
            }
          }
          return false;
        };

        const removed = new Set<string>();
        const next: PlacedItem[] = [];

        for (const it of prev) {
          // Seed adjacent to water -> bloom into plant
          if (it.type === 'seed' && hasTypeAround(it.lat, it.lon, 'water')) {
            next.push({ ...it, type: 'plant', age: 0 });
            continue;
          }
          // Lava: burn flammable neighbors, decay after a few ticks to sand
          if (it.type === 'lava') {
            for (const dla of [-CELL_DEG, 0, CELL_DEG]) {
              for (const dlo of [-CELL_DEG, 0, CELL_DEG]) {
                const arr = cells.get(cellKey(it.lat + dla, it.lon + dlo));
                if (!arr) continue;
                for (const n of arr) if (FLAMMABLE.includes(n.type)) removed.add(n.id);
              }
            }
            const age = (it.age ?? 0) + 1;
            if (age >= 4) next.push({ ...it, type: 'sand', age: 0 });
            else next.push({ ...it, age });
            continue;
          }
          next.push(it);
        }

        // Oil pumps expel oil into a random adjacent cell each tick
        const additions: PlacedItem[] = [];
        for (const it of prev) {
          if (it.type !== 'oilpump') continue;
          const dirs = [-CELL_DEG, 0, CELL_DEG];
          const dx = dirs[Math.floor(Math.random() * 3)];
          const dz = dirs[Math.floor(Math.random() * 3)];
          if (dx === 0 && dz === 0) continue;
          const nlat = Math.round((it.lat + dx) / CELL_DEG) * CELL_DEG;
          const nlon = Math.round((it.lon + dz) / CELL_DEG) * CELL_DEG;
          const k = cellKey(nlat, nlon);
          const stack = [...next, ...additions].filter(
            (x) => !removed.has(x.id) && getItemDef(x.type).kind === 'block' && cellKey(x.lat, x.lon) === k
          ).length;
          if (stack < 8) additions.push({ id: nextId(), type: 'oil', lat: nlat, lon: nlon, stack });
        }

        return [...next.filter((x) => !removed.has(x.id)), ...additions];
      });
    }, SIM_TICK_MS);
    return () => clearInterval(tick);
  }, []);

  // Keyboard handlers
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        if (!heldRef.current) place();
        heldRef.current = true;
        kbMouseHeld.current = true;
      } else if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1;
        if (PALETTE_ITEMS[idx]) { setSelected(PALETTE_ITEMS[idx].id); sfx.click(); }
      } else if (e.key === '0' && PALETTE_ITEMS[9]) {
        setSelected(PALETTE_ITEMS[9].id); sfx.click();
      } else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') {
        e.preventDefault();
        setItems((prev) => prev.slice(0, -1));
        sfx.exit?.();
      } else if (e.key === 'Escape') {
        if (document.pointerLockElement) (document as any).exitPointerLock?.();
        else onExit();
      } else if (e.key === '[' || e.key === ',') {
        const i = PALETTE_ITEMS.findIndex((x) => x.id === selectedRef.current);
        const n = (i - 1 + PALETTE_ITEMS.length) % PALETTE_ITEMS.length;
        setSelected(PALETTE_ITEMS[n].id); sfx.click();
      } else if (e.key === ']' || e.key === '.') {
        const i = PALETTE_ITEMS.findIndex((x) => x.id === selectedRef.current);
        const n = (i + 1) % PALETTE_ITEMS.length;
        setSelected(PALETTE_ITEMS[n].id); sfx.click();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'x' || e.key === 'X') {
        heldRef.current = false;
        kbMouseHeld.current = false;
      }
    };
    const md = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest('[data-hud], button, a, input, select, textarea')) return;
      if (e.button === 0) { if (!heldRef.current) place(); heldRef.current = true; kbMouseHeld.current = true; }
    };
    const mu = (e: MouseEvent) => { if (e.button === 0) { heldRef.current = false; kbMouseHeld.current = false; } };
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

  // Gamepad polling loop
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const gp = gpRef.current;
      if (gp.connected) {
        const padHeld = gp.buttons.x || gp.buttons.a || gp.buttons.rt > 0.4;
        if (padHeld && !heldRef.current && !kbMouseHeld.current) place();
        heldRef.current = kbMouseHeld.current || padHeld;
        if (gp.buttons.rb && !prevBumpers.current.rb) {
          const i = PALETTE_ITEMS.findIndex((x) => x.id === selectedRef.current);
          setSelected(PALETTE_ITEMS[(i + 1) % PALETTE_ITEMS.length].id);
          sfx.click();
        }
        if (gp.buttons.lb && !prevBumpers.current.lb) {
          const i = PALETTE_ITEMS.findIndex((x) => x.id === selectedRef.current);
          setSelected(PALETTE_ITEMS[(i - 1 + PALETTE_ITEMS.length) % PALETTE_ITEMS.length].id);
          sfx.click();
        }
        prevBumpers.current.lb = gp.buttons.lb;
        prevBumpers.current.rb = gp.buttons.rb;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Top bar */}
      <div data-hud className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 rounded-md bg-black/60 backdrop-blur-md border border-white/15">
        <span className="text-white/90 font-mono text-[11px] tracking-wider uppercase">Level 5 · Sandspiel Builder</span>
        <span className="text-white/40 font-mono text-[10px]">WASD walk · X / click to drop in front · seed + water blooms · lava burns · oil pump leaks oil</span>
      </div>

      <button
        data-hud
        onClick={() => { sfx.navPrev(); onPrev(); }}
        className="fixed top-4 left-4 z-40 px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md border border-white/15 text-white/90 font-mono text-[11px] hover:bg-black/80"
      >← Prev</button>
      <button
        data-hud
        onClick={() => { sfx.exit(); onExit(); }}
        className="fixed top-4 right-4 z-40 px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md border border-white/15 text-white/90 font-mono text-[11px] hover:bg-black/80"
      >Exit</button>

      <div data-hud className="fixed top-16 right-4 z-40 px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md border border-white/15 text-white/90 font-mono text-[11px]">
        Placed: <span className="text-white">{items.length}</span>
        {items.length > 0 && (
          <button onClick={() => { setItems([]); sfx.exit?.(); }} className="ml-3 underline text-white/60 hover:text-white">clear</button>
        )}
      </div>

      {/* Hotbar */}
      <div data-hud className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex gap-2 px-3 py-2 rounded-lg bg-black/70 backdrop-blur-md border border-white/15">
        {PALETTE_ITEMS.map((it, i) => {
          const isSel = selected === it.id;
          return (
            <button
              key={it.id}
              onClick={() => { setSelected(it.id); sfx.click(); }}
              className={`flex flex-col items-center justify-center w-14 h-16 rounded-md border-2 transition-all ${
                isSel ? 'border-white bg-white/15 scale-105' : 'border-white/15 bg-black/30 hover:border-white/40'
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

      <div data-hud className="fixed bottom-28 left-1/2 -translate-x-1/2 z-40 px-3 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/15 text-white font-mono text-[11px]">
        Placing: <span className="uppercase tracking-wider">{getItemDef(selected).label}</span>
      </div>
    </>
  );
};

export default MapBuilderHUD;
