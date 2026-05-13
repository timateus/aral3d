/**
 * Conway's Game of Life simulation.
 * Cells live on a fixed-resolution grid and are draped on top of terrain
 * elevations by the LifeOverlay renderer.
 *
 * Communication between the HUD (in Index) and the overlay (inside the R3F
 * Canvas) goes through a tiny event bus + a singleton state object. This
 * avoids threading a dozen new props through TerrainViewer.
 */

export interface LifeState {
  width: number;
  height: number;
  cells: Uint8Array;       // 0 = dead, 1 = alive
  age: Uint16Array;        // generations alive (for color)
  generation: number;
  population: number;
}

export const LIFE_GRID_W = 96;
export const LIFE_GRID_H = 96;

export function createLife(w = LIFE_GRID_W, h = LIFE_GRID_H): LifeState {
  return {
    width: w,
    height: h,
    cells: new Uint8Array(w * h),
    age: new Uint16Array(w * h),
    generation: 0,
    population: 0,
  };
}

export function clearLife(s: LifeState) {
  s.cells.fill(0);
  s.age.fill(0);
  s.generation = 0;
  s.population = 0;
}

export function seedRandom(s: LifeState, density = 0.28) {
  s.cells.fill(0);
  s.age.fill(0);
  let pop = 0;
  // Seed in a centered region for an organic-looking bloom.
  const padX = Math.floor(s.width * 0.12);
  const padY = Math.floor(s.height * 0.12);
  for (let r = padY; r < s.height - padY; r++) {
    for (let c = padX; c < s.width - padX; c++) {
      if (Math.random() < density) {
        s.cells[r * s.width + c] = 1;
        pop++;
      }
    }
  }
  s.generation = 0;
  s.population = pop;
}

const GLIDER = [[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]];
const PULSAR = [
  [2, 4], [2, 5], [2, 6], [2, 10], [2, 11], [2, 12],
  [4, 2], [5, 2], [6, 2], [4, 7], [5, 7], [6, 7],
  [4, 9], [5, 9], [6, 9], [4, 14], [5, 14], [6, 14],
  [7, 4], [7, 5], [7, 6], [7, 10], [7, 11], [7, 12],
  [9, 4], [9, 5], [9, 6], [9, 10], [9, 11], [9, 12],
  [10, 2], [11, 2], [12, 2], [10, 7], [11, 7], [12, 7],
  [10, 9], [11, 9], [12, 9], [10, 14], [11, 14], [12, 14],
  [14, 4], [14, 5], [14, 6], [14, 10], [14, 11], [14, 12],
];

export function seedPattern(s: LifeState, kind: 'gliders' | 'pulsar') {
  s.cells.fill(0);
  s.age.fill(0);
  s.generation = 0;
  if (kind === 'gliders') {
    // Sprinkle ~10 gliders across the grid
    for (let i = 0; i < 10; i++) {
      const r0 = Math.floor(Math.random() * (s.height - 5));
      const c0 = Math.floor(Math.random() * (s.width - 5));
      for (const [dr, dc] of GLIDER) {
        s.cells[(r0 + dr) * s.width + (c0 + dc)] = 1;
      }
    }
  } else {
    const r0 = Math.floor(s.height / 2 - 8);
    const c0 = Math.floor(s.width / 2 - 8);
    for (const [dr, dc] of PULSAR) {
      s.cells[(r0 + dr) * s.width + (c0 + dc)] = 1;
    }
  }
  let pop = 0;
  for (let i = 0; i < s.cells.length; i++) if (s.cells[i]) pop++;
  s.population = pop;
}

export function toggleCell(s: LifeState, r: number, c: number) {
  if (r < 0 || r >= s.height || c < 0 || c >= s.width) return;
  const i = r * s.width + c;
  if (s.cells[i]) {
    s.cells[i] = 0;
    s.age[i] = 0;
    s.population--;
  } else {
    s.cells[i] = 1;
    s.age[i] = 1;
    s.population++;
  }
}

export function stepLife(s: LifeState) {
  const { width: w, height: h, cells, age } = s;
  const next = new Uint8Array(w * h);
  const nextAge = new Uint16Array(w * h);
  let pop = 0;
  for (let r = 0; r < h; r++) {
    const rUp = r === 0 ? h - 1 : r - 1;
    const rDn = r === h - 1 ? 0 : r + 1;
    for (let c = 0; c < w; c++) {
      const cL = c === 0 ? w - 1 : c - 1;
      const cR = c === w - 1 ? 0 : c + 1;
      const n =
        cells[rUp * w + cL] + cells[rUp * w + c] + cells[rUp * w + cR] +
        cells[r * w + cL] + cells[r * w + cR] +
        cells[rDn * w + cL] + cells[rDn * w + c] + cells[rDn * w + cR];
      const i = r * w + c;
      const alive = cells[i] === 1;
      let nv = 0;
      if (alive && (n === 2 || n === 3)) nv = 1;
      else if (!alive && n === 3) nv = 1;
      next[i] = nv;
      if (nv) {
        nextAge[i] = alive ? Math.min(age[i] + 1, 65535) : 1;
        pop++;
      }
    }
  }
  s.cells = next;
  s.age = nextAge;
  s.generation++;
  s.population = pop;
}

/* ── Tiny pub/sub so HUD <-> overlay can talk without prop drilling ── */
type LifeEvent =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'toggle' }
  | { type: 'step' }
  | { type: 'clear' }
  | { type: 'seed-random'; density?: number }
  | { type: 'seed-pattern'; kind: 'gliders' | 'pulsar' }
  | { type: 'speed'; value: number }
  | { type: 'cell-size'; value: number };

const listeners = new Set<(e: LifeEvent) => void>();
export function onLifeEvent(cb: (e: LifeEvent) => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
export function emitLifeEvent(e: LifeEvent) {
  listeners.forEach(l => l(e));
}

/* Stats stream: overlay -> HUD */
export interface LifeStats { generation: number; population: number; running: boolean; speed: number; }
const statsListeners = new Set<(s: LifeStats) => void>();
export function onLifeStats(cb: (s: LifeStats) => void) {
  statsListeners.add(cb);
  return () => { statsListeners.delete(cb); };
}
export function emitLifeStats(s: LifeStats) {
  statsListeners.forEach(l => l(s));
}
