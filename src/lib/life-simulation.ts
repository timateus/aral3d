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
export const DEFAULT_LIFE_CELL_SIZE = 0.11;

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

export function resizeLife(s: LifeState, nextW: number, nextH: number) {
  const oldW = s.width;
  const oldH = s.height;
  if (nextW === oldW && nextH === oldH) return;

  const nextCells = new Uint8Array(nextW * nextH);
  const nextAge = new Uint16Array(nextW * nextH);
  let pop = 0;

  for (let r = 0; r < oldH; r++) {
    for (let c = 0; c < oldW; c++) {
      const oldIdx = r * oldW + c;
      if (!s.cells[oldIdx]) continue;
      const nr = Math.min(nextH - 1, Math.floor(((r + 0.5) / oldH) * nextH));
      const nc = Math.min(nextW - 1, Math.floor(((c + 0.5) / oldW) * nextW));
      const nextIdx = nr * nextW + nc;
      if (!nextCells[nextIdx]) pop++;
      nextCells[nextIdx] = 1;
      nextAge[nextIdx] = Math.max(nextAge[nextIdx], s.age[oldIdx] || 1);
    }
  }

  s.width = nextW;
  s.height = nextH;
  s.cells = nextCells;
  s.age = nextAge;
  s.population = pop;
}

export function clearLife(s: LifeState) {
  s.cells.fill(0);
  s.age.fill(0);
  s.generation = 0;
  s.population = 0;
}

export function seedRandom(s: LifeState, density = 0.28) {
  // Additive: keep existing cells, sprinkle new ones in a random rectangular blob.
  const w = s.width, h = s.height;
  const bw = Math.floor(w * (0.18 + Math.random() * 0.4));
  const bh = Math.floor(h * (0.18 + Math.random() * 0.4));
  const x0 = Math.floor(Math.random() * (w - bw));
  const y0 = Math.floor(Math.random() * (h - bh));
  let pop = s.population;
  for (let r = y0; r < y0 + bh; r++) {
    for (let c = x0; c < x0 + bw; c++) {
      if (Math.random() < density) {
        const i = r * w + c;
        if (!s.cells[i]) {
          s.cells[i] = 1;
          s.age[i] = 1;
          pop++;
        }
      }
    }
  }
  s.population = pop;
}

/**
 * Karakalpak-inspired ornamental stamp: 4-fold symmetric geometric motif at
 * a random position with a random size. Built by drawing a few rhomboid /
 * cross / hook strokes inside one quadrant and mirroring across both axes.
 */
export function seedQaraqalpaq(s: LifeState, sizeOpt?: number, cxOpt?: number, cyOpt?: number) {
  const w = s.width, h = s.height;
  const size = sizeOpt ?? (8 + Math.floor(Math.random() * 18)); // 8..25 (half-extent)
  const cx = cxOpt ?? Math.floor(size + Math.random() * (w - size * 2));
  const cy = cyOpt ?? Math.floor(size + Math.random() * (h - size * 2));
  // Build a quadrant pattern of size×size, then mirror to make 4-fold symmetry.
  const quad = new Uint8Array(size * size);
  const set = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    quad[y * size + x] = 1;
  };
  // Diagonal rhombus edge
  for (let i = 0; i < size; i++) set(i, size - 1 - i);
  // Inner diamond
  const inner = Math.max(2, Math.floor(size * 0.55));
  for (let i = 0; i < inner; i++) set(i, inner - 1 - i);
  // A few random hook strokes
  const hooks = 2 + Math.floor(Math.random() * 3);
  for (let k = 0; k < hooks; k++) {
    const hx = Math.floor(Math.random() * size);
    const hy = Math.floor(Math.random() * size);
    const len = 2 + Math.floor(Math.random() * Math.max(2, size / 3));
    const horiz = Math.random() < 0.5;
    for (let i = 0; i < len; i++) {
      if (horiz) set(hx + i, hy); else set(hx, hy + i);
    }
    // Hook turn
    for (let i = 0; i < Math.max(2, len / 2); i++) {
      if (horiz) set(hx + len, hy + i); else set(hx + i, hy + len);
    }
  }
  // Center cross
  for (let i = 0; i < Math.max(2, size / 4); i++) { set(i, 0); set(0, i); }
  // Stamp with 4-fold symmetry
  let pop = s.population;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!quad[y * size + x]) continue;
      const points = [
        [cx + x, cy + y],
        [cx - 1 - x, cy + y],
        [cx + x, cy - 1 - y],
        [cx - 1 - x, cy - 1 - y],
      ];
      for (const [px, py] of points) {
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        const i = py * w + px;
        if (!s.cells[i]) {
          s.cells[i] = 1;
          s.age[i] = 1;
          pop++;
        }
      }
    }
  }
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
  // Additive: stamp on top of the existing population.
  const setCell = (i: number) => {
    if (!s.cells[i]) {
      s.cells[i] = 1;
      s.age[i] = 1;
      s.population++;
    }
  };
  if (kind === 'gliders') {
    for (let i = 0; i < 10; i++) {
      const r0 = Math.floor(Math.random() * (s.height - 5));
      const c0 = Math.floor(Math.random() * (s.width - 5));
      for (const [dr, dc] of GLIDER) setCell((r0 + dr) * s.width + (c0 + dc));
    }
  } else {
    const r0 = Math.floor(s.height / 2 - 8);
    const c0 = Math.floor(s.width / 2 - 8);
    for (const [dr, dc] of PULSAR) setCell((r0 + dr) * s.width + (c0 + dc));
  }
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
export type LifeColorMode = 'age' | 'surface' | 'bright';
export interface LifeSettings { cellSize: number; colorMode: LifeColorMode; }
const lifeSettings: LifeSettings = { cellSize: DEFAULT_LIFE_CELL_SIZE, colorMode: 'age' };
export function getLifeSettings(): LifeSettings { return { ...lifeSettings }; }
export function setLifeSettings(next: Partial<LifeSettings>) { Object.assign(lifeSettings, next); }

export type LifeEvent =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'toggle' }
  | { type: 'step' }
  | { type: 'clear' }
  | { type: 'seed-random'; density?: number }
  | { type: 'seed-pattern'; kind: 'gliders' | 'pulsar' }
  | { type: 'seed-qaraqalpaq' }
  | { type: 'color-mode'; mode: LifeColorMode }
  | { type: 'speed'; value: number }
  | { type: 'cell-size'; value: number };

const listeners = new Set<(e: LifeEvent) => void>();
export function onLifeEvent(cb: (e: LifeEvent) => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
export function emitLifeEvent(e: LifeEvent) {
  if (e.type === 'color-mode') setLifeSettings({ colorMode: e.mode });
  if (e.type === 'cell-size') setLifeSettings({ cellSize: e.value });
  listeners.forEach(l => l(e));
}

/* Stats stream: overlay -> HUD */
export interface LifeStats {
  generation: number;
  population: number;
  running: boolean;
  speed: number;
  cellSize?: number;
  colorMode?: LifeColorMode;
  gridWidth?: number;
  gridHeight?: number;
}
const statsListeners = new Set<(s: LifeStats) => void>();
export function onLifeStats(cb: (s: LifeStats) => void) {
  statsListeners.add(cb);
  return () => { statsListeners.delete(cb); };
}
export function emitLifeStats(s: LifeStats) {
  statsListeners.forEach(l => l(s));
}
