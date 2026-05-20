import { useEffect, useState, useCallback } from 'react';
import type { BlockId } from '@/lib/voxel/block-types';

export interface InventorySlot { block: BlockId | null; count: number; }

const HOTBAR_SIZE = 9;
const STORAGE_KEY = 'voxel_inventory_v1';

interface InventoryState {
  hotbar: InventorySlot[];
  selected: number;
}

function makeEmpty(): InventoryState {
  const hotbar: InventorySlot[] = Array.from({ length: HOTBAR_SIZE }, () => ({ block: null, count: 0 }));
  return { hotbar, selected: 0 };
}

let _state: InventoryState = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as InventoryState;
      if (p && Array.isArray(p.hotbar) && p.hotbar.length === HOTBAR_SIZE) return p;
    }
  } catch { }
  return makeEmpty();
})();

const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());
const persist = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); } catch { } };

function addBlock(block: BlockId, count = 1) {
  // First, try to stack onto existing slot of same block.
  for (const slot of _state.hotbar) {
    if (slot.block === block) { slot.count += count; persist(); notify(); return; }
  }
  // Otherwise, find the first empty slot.
  for (const slot of _state.hotbar) {
    if (slot.block === null) { slot.block = block; slot.count = count; persist(); notify(); return; }
  }
  // Otherwise drop (inventory full).
}

function removeOneFromSelected(): BlockId | null {
  const slot = _state.hotbar[_state.selected];
  if (!slot || !slot.block || slot.count <= 0) return null;
  const b = slot.block;
  slot.count -= 1;
  if (slot.count <= 0) { slot.block = null; slot.count = 0; }
  persist(); notify();
  return b;
}

function setSelected(i: number) {
  if (i < 0 || i >= HOTBAR_SIZE) return;
  _state.selected = i;
  persist(); notify();
}

function clearInventory() {
  _state = makeEmpty();
  persist(); notify();
}

function consumeForRecipe(inputs: { block: BlockId; count: number }[]): boolean {
  // Check
  for (const inp of inputs) {
    let avail = 0;
    for (const s of _state.hotbar) if (s.block === inp.block) avail += s.count;
    if (avail < inp.count) return false;
  }
  // Consume
  for (const inp of inputs) {
    let remaining = inp.count;
    for (const s of _state.hotbar) {
      if (s.block !== inp.block || remaining <= 0) continue;
      const take = Math.min(s.count, remaining);
      s.count -= take; remaining -= take;
      if (s.count <= 0) { s.block = null; s.count = 0; }
    }
  }
  persist(); notify();
  return true;
}

export function useVoxelInventory() {
  const [, force] = useState(0);
  useEffect(() => {
    const cb = () => force(x => x + 1);
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);

  const add = useCallback((b: BlockId, c = 1) => addBlock(b, c), []);
  const useSelected = useCallback(() => removeOneFromSelected(), []);
  const select = useCallback((i: number) => setSelected(i), []);
  const clear = useCallback(() => clearInventory(), []);
  const craft = useCallback((inputs: { block: BlockId; count: number }[]) => consumeForRecipe(inputs), []);

  return {
    hotbar: _state.hotbar,
    selected: _state.selected,
    add, useSelected, select, clear, craft,
  };
}

export { HOTBAR_SIZE };
