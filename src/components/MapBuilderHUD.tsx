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
import { remapPadLabel } from '@/lib/pad-labels';
import { loadState, saveState } from '@/lib/game-persistence';

interface Props {
  onExit: () => void;
  onPrev: () => void;
  onNext?: () => void;
  getAimLatLon?: () => { lat: number; lon: number } | null;
  onItemsChange: (items: PlacedItem[]) => void;
}

let _uid = 0;
const nextId = () => `pl-${++_uid}-${Date.now().toString(36)}`;
const SIM_TICK_MS = 220;
const HOLD_MS = 2000;
const REPEAT_MS = 250;
const ACTION_LIMIT = 50;
const ACTIONS_KEY = 'level5-actions';
const SALT_KILL_RADIUS_CELLS = 5;
const FLAMMABLE: MapBuilderItemId[] = ['seed', 'plant', 'flower', 'saxaul', 'reed', 'oil'];

const MapBuilderHUD = ({ onExit, onPrev, onNext, getAimLatLon, onItemsChange }: Props) => {
  const [selected, setSelected] = useState<MapBuilderItemId>('water');
  // Hydrate from the same key Index.tsx uses so blocks persist across exits.
  const [items, setItems] = useState<PlacedItem[]>(() =>
    loadState<PlacedItem[]>('placed-items', [])
  );
  const [confirmNav, setConfirmNav] = useState<null | 'prev' | 'next'>(null);
  const [actionsLeft, setActionsLeft] = useState<number>(() => loadState<number>(ACTIONS_KEY, ACTION_LIMIT));
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedRef = useRef(selected);
  const itemsRef = useRef(items);
  const actionsRef = useRef(actionsLeft);
  const { stateRef: gpRef } = useGamepad();
  const prevPad = useRef({ lb: false, rb: false, back: false, start: false, a: false, b: false, x: false, y: false, dl: false, dr: false });

  // Hold-to-repeat for place + remove. After 2s of continuous hold, fire every 250ms.
  const heldPlace = useRef<{ start: number | null; last: number }>({ start: null, last: 0 });
  const heldRemove = useRef<{ start: number | null; last: number }>({ start: null, last: 0 });

  // Fish reproduction bookkeeping.
  const lastFishSpawn = useRef(0);
  const fishCapRef = useRef(6);

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => {
    itemsRef.current = items;
    firstPersonBridge.placedItems = items;
    onItemsChange(items);
  }, [items, onItemsChange]);
  useEffect(() => { actionsRef.current = actionsLeft; saveState(ACTIONS_KEY, actionsLeft); }, [actionsLeft]);
  const confirmNavRef = useRef<null | 'prev' | 'next'>(null);
  useEffect(() => { confirmNavRef.current = confirmNav; }, [confirmNav]);

  // 50-action budget resets when leaving Level 5 (component unmount). Placed
  // items themselves persist (loaded from 'placed-items' on mount above).
  useEffect(() => () => {
    try { localStorage.removeItem('aral3d:v1:' + ACTIONS_KEY); } catch {}
  }, []);

  // Opening the picker needs the cursor — release pointer lock so clicks land.
  useEffect(() => {
    if (pickerOpen && document.pointerLockElement) {
      try { (document as any).exitPointerLock?.(); } catch {}
    }
  }, [pickerOpen]);

  const requestNav = (dir: 'prev' | 'next') => {
    sfx.click?.();
    setConfirmNav(dir);
  };
  const performNav = (dir: 'prev' | 'next') => {
    sfx[dir === 'prev' ? 'navPrev' : 'navNext']?.();
    setConfirmNav(null);
    if (dir === 'prev') onPrev();
    else onNext?.();
  };

  const readAim = (): { lat: number; lon: number } | null => {
    if (getAimLatLon) {
      const a = getAimLatLon();
      if (a) return a;
    }
    return firstPersonBridge.aim;
  };

  // PLACE: decrements action budget. Blocked at 0.
  const place = () => {
    if (actionsRef.current <= 0) return;
    const ll = readAim();
    if (!ll) return;
    const snapped = snapLatLon(ll.lat, ll.lon);
    const key = cellKey(snapped.lat, snapped.lon);
    const def = getItemDef(selectedRef.current);
    const stack = def.kind === 'block'
      ? itemsRef.current.filter((it) => getItemDef(it.type).kind === 'block' && cellKey(it.lat, it.lon) === key).length
      : 0;
    const newItem: PlacedItem = {
      id: nextId(),
      type: selectedRef.current,
      lat: snapped.lat,
      lon: snapped.lon,
      stack,
    };

    setItems((prev) => {
      let next = [...prev, newItem];
      // Salt kills nearby camels + fish (within 5 cells).
      if (newItem.type === 'salt') {
        const r = SALT_KILL_RADIUS_CELLS * CELL_DEG;
        const r2 = r * r;
        next = next.filter((it) => {
          if (it.type !== 'camel' && it.type !== 'fish') return true;
          const dlat = it.lat - newItem.lat;
          const dlon = it.lon - newItem.lon;
          return dlat * dlat + dlon * dlon > r2;
        });
      }
      // Track fish cap = 3× current fish population at user-placement time.
      if (newItem.type === 'fish') {
        const fishCount = next.filter((x) => x.type === 'fish').length;
        fishCapRef.current = Math.max(fishCapRef.current, fishCount * 3, 6);
      }
      return next;
    });
    setActionsLeft((n) => Math.max(0, n - 1));
  };

  // REMOVE: pops the most recent item (free — does not consume action budget).
  const remove = () => {
    setItems((prev) => (prev.length === 0 ? prev : prev.slice(0, -1)));
    sfx.exit?.();
  };

  const resetActions = () => {
    setActionsLeft(ACTION_LIMIT);
    sfx.click?.();
  };

  // ----- Sandspiel-style simulation tick (intense) + water flow + fish breed -----
  useEffect(() => {
    const tick = setInterval(() => {
      setItems((prev) => {
        const cells = new Map<string, PlacedItem[]>();
        for (const it of prev) {
          const k = cellKey(it.lat, it.lon);
          let arr = cells.get(k);
          if (!arr) { arr = []; cells.set(k, arr); }
          arr.push(it);
        }
        const neighborsOf = (lat: number, lon: number) => {
          const out: PlacedItem[] = [];
          for (const dla of [-CELL_DEG, 0, CELL_DEG]) {
            for (const dlo of [-CELL_DEG, 0, CELL_DEG]) {
              if (dla === 0 && dlo === 0) continue;
              const arr = cells.get(cellKey(lat + dla, lon + dlo));
              if (arr) out.push(...arr);
            }
          }
          return out;
        };
        const hasType = (lat: number, lon: number, type: MapBuilderItemId) =>
          neighborsOf(lat, lon).some((x) => x.type === type);

        const removed = new Set<string>();
        const next: PlacedItem[] = [];
        const additions: PlacedItem[] = [];

        const stackAt = (lat: number, lon: number) => {
          const k = cellKey(lat, lon);
          return [...next, ...additions].filter(
            (x) => !removed.has(x.id) && getItemDef(x.type).kind === 'block' && cellKey(x.lat, x.lon) === k
          ).length;
        };
        const placeBlock = (type: MapBuilderItemId, lat: number, lon: number, age = 0) => {
          if (stackAt(lat, lon) >= 10) return;
          additions.push({ id: nextId(), type, lat, lon, stack: stackAt(lat, lon), age });
        };

        for (const it of prev) {
          if (it.type === 'seed') {
            if (hasType(it.lat, it.lon, 'water')) {
              next.push({ ...it, type: 'plant', age: 0 });
              continue;
            }
            next.push(it); continue;
          }
          if (it.type === 'plant') {
            const age = (it.age ?? 0) + 1;
            if (Math.random() < 0.35) {
              const dirs = [[-CELL_DEG, 0], [CELL_DEG, 0], [0, -CELL_DEG], [0, CELL_DEG]];
              const [dla, dlo] = dirs[Math.floor(Math.random() * 4)];
              const nlat = Math.round((it.lat + dla) / CELL_DEG) * CELL_DEG;
              const nlon = Math.round((it.lon + dlo) / CELL_DEG) * CELL_DEG;
              const occupied = cells.get(cellKey(nlat, nlon))?.some((x) => getItemDef(x.type).kind === 'block');
              if (!occupied && hasType(it.lat, it.lon, 'water')) {
                placeBlock(Math.random() < 0.5 ? 'flower' : 'plant', nlat, nlon);
              }
            }
            if (age > 3 && Math.random() < 0.5) {
              next.push({ ...it, type: 'flower', age: 0 });
              continue;
            }
            next.push({ ...it, age }); continue;
          }
          if (it.type === 'lava') {
            for (const n of neighborsOf(it.lat, it.lon)) {
              if (FLAMMABLE.includes(n.type)) {
                removed.add(n.id);
                placeBlock('fire', n.lat, n.lon);
              }
            }
            const age = (it.age ?? 0) + 1;
            if (age >= 6) { placeBlock('smoke', it.lat, it.lon); next.push({ ...it, type: 'sand', age: 0 }); }
            else next.push({ ...it, age });
            continue;
          }
          if (it.type === 'fire') {
            for (const n of neighborsOf(it.lat, it.lon)) {
              if (FLAMMABLE.includes(n.type) && Math.random() < 0.6) {
                removed.add(n.id);
                placeBlock('fire', n.lat, n.lon);
              }
              if (n.type === 'water' && Math.random() < 0.4) {
                removed.add(it.id);
              }
            }
            const age = (it.age ?? 0) + 1;
            if (age >= 4) { placeBlock('smoke', it.lat, it.lon); removed.add(it.id); }
            else next.push({ ...it, age });
            continue;
          }
          if (it.type === 'smoke') {
            const age = (it.age ?? 0) + 1;
            if (age >= 5) { removed.add(it.id); continue; }
            next.push({ ...it, age }); continue;
          }
          next.push(it);
        }

        // -------- WATER HYDRAULIC FLOW --------
        // For each cell, count its stack (height). If the top block is water and
        // a 4-neighbor cell's stack is ≥2 lower, move one water block onto it.
        const stackOfRaw = new Map<string, PlacedItem[]>();
        for (const it of [...next, ...additions]) {
          if (removed.has(it.id)) continue;
          if (getItemDef(it.type).kind !== 'block') continue;
          const k = cellKey(it.lat, it.lon);
          let arr = stackOfRaw.get(k);
          if (!arr) { arr = []; stackOfRaw.set(k, arr); }
          arr.push(it);
        }
        const stackKeys = Array.from(stackOfRaw.keys());
        // Shuffle to avoid directional bias.
        for (let s = stackKeys.length - 1; s > 0; s--) {
          const r = Math.floor(Math.random() * (s + 1));
          [stackKeys[s], stackKeys[r]] = [stackKeys[r], stackKeys[s]];
        }
        const flowMoves = new Map<string, number>(); // id -> targetK lookup not needed; we mutate inline
        for (const k of stackKeys) {
          const arr = stackOfRaw.get(k)!;
          if (arr.length === 0) continue;
          const top = arr[arr.length - 1];
          if (top.type !== 'water') continue;
          const [latStr, lonStr] = k.split('|');
          const lat = parseFloat(latStr);
          const lon = parseFloat(lonStr);
          const dirs = [[-CELL_DEG, 0], [CELL_DEG, 0], [0, -CELL_DEG], [0, CELL_DEG]];
          let bestK: string | null = null;
          let bestH = arr.length;
          let bestLat = lat;
          let bestLon = lon;
          for (const [dla, dlo] of dirs) {
            const nlat = Math.round((lat + dla) / CELL_DEG) * CELL_DEG;
            const nlon = Math.round((lon + dlo) / CELL_DEG) * CELL_DEG;
            const nk = cellKey(nlat, nlon);
            const nh = (stackOfRaw.get(nk)?.length) ?? 0;
            if (arr.length - nh < 2) continue;
            if (nh < bestH) { bestH = nh; bestK = nk; bestLat = nlat; bestLon = nlon; }
          }
          if (!bestK) continue;
          // Move: remove top water from this cell, add a fresh water block at neighbor.
          removed.add(top.id);
          arr.pop();
          const newWater: PlacedItem = {
            id: nextId(),
            type: 'water',
            lat: bestLat,
            lon: bestLon,
            stack: bestH,
          };
          additions.push(newWater);
          let dst = stackOfRaw.get(bestK);
          if (!dst) { dst = []; stackOfRaw.set(bestK, dst); }
          dst.push(newWater);
          flowMoves.set(top.id, 1);
        }

        // Water cells: occasionally spawn fish (existing behavior).
        const waterCells = prev.filter((x) => x.type === 'water');
        for (const w of waterCells) {
          if (Math.random() < 0.04) {
            const hasFish = neighborsOf(w.lat, w.lon).some((n) => n.type === 'fish');
            if (!hasFish) additions.push({ id: nextId(), type: 'fish', lat: w.lat, lon: w.lon });
          }
        }

        // FISH REPRODUCTION — every ~5s spawn one new fish next to a random fish.
        const nowMs = performance.now();
        if (nowMs - lastFishSpawn.current >= 5000) {
          lastFishSpawn.current = nowMs;
          const fishList = [...next, ...additions].filter((x) => !removed.has(x.id) && x.type === 'fish');
          if (fishList.length > 0 && fishList.length < fishCapRef.current) {
            const parent = fishList[Math.floor(Math.random() * fishList.length)];
            const dirs = [[-CELL_DEG, 0], [CELL_DEG, 0], [0, -CELL_DEG], [0, CELL_DEG]];
            const [dla, dlo] = dirs[Math.floor(Math.random() * 4)];
            additions.push({
              id: nextId(),
              type: 'fish',
              lat: Math.round((parent.lat + dla) / CELL_DEG) * CELL_DEG,
              lon: Math.round((parent.lon + dlo) / CELL_DEG) * CELL_DEG,
              bornAt: nowMs,
            });
          }
        }

        // Oil pumps expel oil each tick.
        for (const it of prev) {
          if (it.type !== 'oilpump') continue;
          const dirs = [-CELL_DEG, 0, CELL_DEG];
          const dx = dirs[Math.floor(Math.random() * 3)];
          const dz = dirs[Math.floor(Math.random() * 3)];
          if (dx === 0 && dz === 0) continue;
          const nlat = Math.round((it.lat + dx) / CELL_DEG) * CELL_DEG;
          const nlon = Math.round((it.lon + dz) / CELL_DEG) * CELL_DEG;
          placeBlock('oil', nlat, nlon);
        }

        return [...next.filter((x) => !removed.has(x.id)), ...additions];
      });
    }, SIM_TICK_MS);
    return () => clearInterval(tick);
  }, []);

  // Hold-to-repeat loop (rAF): first action immediate on press; after 2s of
  // continuous hold, repeat every 250ms. Driven by heldPlace/heldRemove refs.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const now = performance.now();
      const h = heldPlace.current;
      if (h.start != null && now - h.start > HOLD_MS && now - h.last > REPEAT_MS) {
        place();
        h.last = now;
      }
      const r = heldRemove.current;
      if (r.start != null && now - r.start > HOLD_MS && now - r.last > REPEAT_MS) {
        remove();
        r.last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        if (heldPlace.current.start == null) {
          place();
          heldPlace.current.start = performance.now();
          heldPlace.current.last = performance.now();
        }
      } else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') {
        e.preventDefault();
        if (heldRemove.current.start == null) {
          remove();
          heldRemove.current.start = performance.now();
          heldRemove.current.last = performance.now();
        }
      } else if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1;
        if (PALETTE_ITEMS[idx]) { setSelected(PALETTE_ITEMS[idx].id); sfx.click(); }
      } else if (e.key === '0' && PALETTE_ITEMS[9]) {
        setSelected(PALETTE_ITEMS[9].id); sfx.click();
      } else if (e.key === 'Escape') {
        if (pickerOpen) { setPickerOpen(false); return; }
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
      if (e.key === 'x' || e.key === 'X') heldPlace.current.start = null;
      if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') heldRemove.current.start = null;
    };
    const md = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest('[data-hud], button, a, input, select, textarea')) return;
      if (e.button === 0) {
        if (heldPlace.current.start == null) {
          place();
          heldPlace.current.start = performance.now();
          heldPlace.current.last = performance.now();
        }
      } else if (e.button === 2) {
        if (heldRemove.current.start == null) {
          remove();
          heldRemove.current.start = performance.now();
          heldRemove.current.last = performance.now();
        }
      }
    };
    const mu = (e: MouseEvent) => {
      if (e.button === 0) heldPlace.current.start = null;
      if (e.button === 2) heldRemove.current.start = null;
    };
    const mc = (e: Event) => { e.preventDefault(); };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    window.addEventListener('mousedown', md);
    window.addEventListener('mouseup', mu);
    window.addEventListener('contextmenu', mc);
    return () => {
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
      window.removeEventListener('mousedown', md);
      window.removeEventListener('mouseup', mu);
      window.removeEventListener('contextmenu', mc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen]);

  // Gamepad polling
  // 4 (Y) = open material picker, 3 (X) = build, 2 (B) = destroy, 1 (A) = top-down view.
  // RB / LB mirror build / destroy. RT / LT = zoom. dpad L/R cycles palette.
  // Back / Start = prev / next level.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const gp = gpRef.current;
      if (gp.connected) {
        const buttons: any = gp.buttons;
        const aP = !!buttons.a, bP = !!buttons.b, xP = !!buttons.x, yP = !!buttons.y;
        const lbP = !!buttons.lb, rbP = !!buttons.rb;
        const backP = !!buttons.back, startP = !!buttons.start;
        const dlP = !!buttons.left, drP = !!buttons.right;

        // If a confirmation dialog is open, gamepad A confirms, B cancels.
        const cn = confirmNavRef.current; if (cn) {
          if (aP && !prevPad.current.a) performNav(cn);
          if (bP && !prevPad.current.b) { sfx.exit?.(); setConfirmNav(null); }
          prevPad.current.a = aP; prevPad.current.b = bP; prevPad.current.x = xP; prevPad.current.y = yP;
          prevPad.current.lb = lbP; prevPad.current.rb = rbP;
          prevPad.current.back = backP; prevPad.current.start = startP;
          prevPad.current.dl = dlP; prevPad.current.dr = drP;
          raf = requestAnimationFrame(loop);
          return;
        }

        // Build (X) hold-to-repeat
        const buildHeld = xP;
        if (buildHeld && heldPlace.current.start == null) {
          place();
          heldPlace.current.start = performance.now();
          heldPlace.current.last = performance.now();
        } else if (!buildHeld && heldPlace.current.start != null) {
          heldPlace.current.start = null;
        }
        // Destroy (B) hold-to-repeat
        const destroyHeld = bP;
        if (destroyHeld && heldRemove.current.start == null) {
          remove();
          heldRemove.current.start = performance.now();
          heldRemove.current.last = performance.now();
        } else if (!destroyHeld && heldRemove.current.start != null) {
          heldRemove.current.start = null;
        }

        // Y rising edge: toggle material picker
        if (yP && !prevPad.current.y) { setPickerOpen((o) => !o); sfx.click?.(); }
        // dpad palette cycle
        if (drP && !prevPad.current.dr) {
          const i = PALETTE_ITEMS.findIndex((x) => x.id === selectedRef.current);
          setSelected(PALETTE_ITEMS[(i + 1) % PALETTE_ITEMS.length].id);
          sfx.click();
        }
        if (dlP && !prevPad.current.dl) {
          const i = PALETTE_ITEMS.findIndex((x) => x.id === selectedRef.current);
          setSelected(PALETTE_ITEMS[(i - 1 + PALETTE_ITEMS.length) % PALETTE_ITEMS.length].id);
          sfx.click();
        }
        // RB / LB: request level nav (with confirmation overlay)
        if (rbP && !prevPad.current.rb && onNext) requestNav('next');
        if (lbP && !prevPad.current.lb) requestNav('prev');
        if (backP && !prevPad.current.back) requestNav('prev');
        if (startP && !prevPad.current.start && onNext) requestNav('next');

        // Triggers: RT / LT zoom
        const rt = (buttons.rt as number) ?? 0;
        const lt = (buttons.lt as number) ?? 0;
        if (rt > 0.1 || lt > 0.1) {
          const delta = (rt - lt) * 0.06;
          window.dispatchEvent(new CustomEvent('level5:zoom', { detail: { delta } }));
        }

        prevPad.current.a = aP; prevPad.current.b = bP; prevPad.current.x = xP; prevPad.current.y = yP;
        prevPad.current.lb = lbP; prevPad.current.rb = rbP;
        prevPad.current.back = backP; prevPad.current.start = startP;
        prevPad.current.dl = dlP; prevPad.current.dr = drP;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------- UI -----------------------------
  const isOut = actionsLeft === 0;
  const isLow = actionsLeft > 0 && actionsLeft <= 10;

  return (
    <>
      {/* Top bar */}
      <div data-hud className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 rounded-md bg-black/60 backdrop-blur-md border border-white/15">
        <span className="text-white/90 font-mono text-[11px] tracking-wider uppercase">Level 5 · Sandspiel Builder</span>
        <span className="text-white/40 font-mono text-[10px]">WASD walk · X build · Z remove · 1-9 material · Y picker · A top-down · R2/L2 zoom</span>
      </div>

      <button
        data-hud
        onClick={() => requestNav('prev')}
        className="fixed top-4 left-4 z-40 px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md border border-white/15 text-white/90 font-mono text-[11px] hover:bg-black/80"
      >← Prev</button>
      <button
        data-hud
        onClick={() => { sfx.exit(); onExit(); }}
        className="fixed top-4 right-4 z-40 px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md border border-white/15 text-white/90 font-mono text-[11px] hover:bg-black/80"
      >Exit</button>
      {onNext && (
        <button
          data-hud
          onClick={() => requestNav('next')}
          aria-label="next level"
          className="fixed right-2 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center justify-center text-white/85 hover:text-white"
          title="Next level: Kegeyli School 12"
        >
          <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          <span className="mt-1 px-2 py-0.5 text-[10px] font-mono border border-white/40 rounded">→ Level 6</span>
        </button>
      )}

      {/* Action budget pill (top-right, below Exit) */}
      <div
        data-hud
        className={`fixed top-16 right-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-md backdrop-blur-md border font-mono text-[11px] ${
          isOut
            ? 'bg-red-900/70 border-red-300 text-red-100 animate-pulse'
            : isLow
              ? 'bg-amber-900/70 border-amber-300 text-amber-100'
              : 'bg-black/60 border-white/15 text-white/90'
        }`}
      >
        {isOut ? (
          <span className="font-semibold tracking-wide">next person's turn maybe?</span>
        ) : (
          <span>Actions {actionsLeft}/{ACTION_LIMIT}</span>
        )}
        <button
          onClick={resetActions}
          className="ml-1 px-2 py-0.5 text-[10px] uppercase tracking-widest border border-white/30 rounded hover:bg-white/10"
        >Reset</button>
      </div>

      <div data-hud className="fixed top-28 right-4 z-40 px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md border border-white/15 text-white/90 font-mono text-[11px]">
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
              className={`flex flex-col items-center justify-center w-12 h-14 rounded border text-[18px] transition-all ${
                isSel
                  ? 'bg-white text-black border-white scale-110 shadow-lg'
                  : 'bg-black/40 text-white border-white/20 hover:bg-white/10'
              }`}
              title={`${it.label} (${i + 1})`}
            >
              <span>{it.emoji}</span>
              <span className="text-[8px] mt-0.5 uppercase tracking-wider opacity-70">{i + 1}</span>
            </button>
          );
        })}
      </div>

      {/* Material picker overlay (Y on gamepad) */}
      {pickerOpen && (
        <div data-hud className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setPickerOpen(false)}>
          <div className="p-5 rounded-md border border-white/20 bg-zinc-900 text-white font-mono max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs uppercase tracking-[0.25em] text-white/50 mb-3">Choose material</div>
            <div className="grid grid-cols-5 gap-2">
              {PALETTE_ITEMS.map((it) => (
                <button
                  key={it.id}
                  onClick={() => { setSelected(it.id); setPickerOpen(false); sfx.click(); }}
                  className={`flex flex-col items-center justify-center w-16 h-16 rounded border text-[22px] ${
                    selected === it.id ? 'bg-white text-black border-white' : 'bg-black/40 text-white border-white/20 hover:bg-white/10'
                  }`}
                >
                  <span>{it.emoji}</span>
                  <span className="text-[8px] mt-0.5 uppercase opacity-70">{it.label}</span>
                </button>
              ))}
            </div>
            <div className="text-[10px] text-white/40 mt-3 text-right">
              Press <span className="px-1 border border-white/30 rounded">{remapPadLabel('Y').text}</span> or Esc to close
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MapBuilderHUD;
