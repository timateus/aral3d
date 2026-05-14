/**
 * Cellular automata simulations rendered by LifeOverlay.
 * Supports 2D Conway Life, a stacked 3D Life variant, and a lightweight Lenia field.
 */

export type LifeVariant = 'life2d' | 'life3d' | 'lenia';

export interface LifeState {
  width: number;
  height: number;
  depth: number;
  variant: LifeVariant;
  cells: Uint8Array;       // 0 = dead, 1 = alive/visible
  age: Uint16Array;        // generations alive (for color)
  values?: Float32Array;   // Lenia continuous field, 0..1
  generation: number;
  population: number;
}

export const LIFE_GRID_W = 96;
export const LIFE_GRID_H = 96;
export const DEFAULT_LIFE_CELL_SIZE = 0.11;
export const DEFAULT_LIFE_VARIANT: LifeVariant = 'life2d';

const leniaScratch = new WeakMap<LifeState, Float32Array>();

const totalFor = (w: number, h: number, d: number) => w * h * d;
const idx3 = (s: LifeState, z: number, r: number, c: number) => (z * s.height + r) * s.width + c;

export function createLife(w = LIFE_GRID_W, h = LIFE_GRID_H, variant: LifeVariant = DEFAULT_LIFE_VARIANT): LifeState {
  const depth = variant === 'life3d' ? 9 : 1;
  const total = totalFor(w, h, depth);
  return {
    width: w,
    height: h,
    depth,
    variant,
    cells: new Uint8Array(total),
    age: new Uint16Array(total),
    values: variant === 'lenia' ? new Float32Array(total) : undefined,
    generation: 0,
    population: 0,
  };
}

export function setLifeVariant(s: LifeState, variant: LifeVariant) {
  if (s.variant === variant) return;
  s.variant = variant;
  s.depth = variant === 'life3d' ? 9 : 1;
  s.cells = new Uint8Array(totalFor(s.width, s.height, s.depth));
  s.age = new Uint16Array(s.cells.length);
  s.values = variant === 'lenia' ? new Float32Array(s.cells.length) : undefined;
  s.generation = 0;
  s.population = 0;
  if (variant === 'lenia') seedLenia(s);
  else seedRandom(s, variant === 'life3d' ? 0.17 : 0.28);
}

export function resizeLife(s: LifeState, nextW: number, nextH: number) {
  const oldW = s.width;
  const oldH = s.height;
  const oldD = s.depth;
  const nextD = s.variant === 'life3d' ? 9 : 1;
  if (nextW === oldW && nextH === oldH && nextD === oldD) return;

  const nextCells = new Uint8Array(totalFor(nextW, nextH, nextD));
  const nextAge = new Uint16Array(nextCells.length);
  const nextValues = s.variant === 'lenia' ? new Float32Array(nextCells.length) : undefined;
  let pop = 0;

  for (let z = 0; z < oldD; z++) {
    for (let r = 0; r < oldH; r++) {
      for (let c = 0; c < oldW; c++) {
        const oldIdx = (z * oldH + r) * oldW + c;
        const nr = Math.min(nextH - 1, Math.floor(((r + 0.5) / oldH) * nextH));
        const nc = Math.min(nextW - 1, Math.floor(((c + 0.5) / oldW) * nextW));
        const nz = Math.min(nextD - 1, Math.floor(((z + 0.5) / oldD) * nextD));
        const nextIdx = (nz * nextH + nr) * nextW + nc;
        if (s.values && nextValues) nextValues[nextIdx] = Math.max(nextValues[nextIdx], s.values[oldIdx]);
        if (!s.cells[oldIdx]) continue;
        if (!nextCells[nextIdx]) pop++;
        nextCells[nextIdx] = 1;
        nextAge[nextIdx] = Math.max(nextAge[nextIdx], s.age[oldIdx] || 1);
      }
    }
  }

  s.width = nextW;
  s.height = nextH;
  s.depth = nextD;
  s.cells = nextCells;
  s.age = nextAge;
  s.values = nextValues;
  s.population = pop;
}

export function clearLife(s: LifeState) {
  s.cells.fill(0);
  s.age.fill(0);
  s.values?.fill(0);
  s.generation = 0;
  s.population = 0;
}

export function seedRandom(s: LifeState, density = s.variant === 'life3d' ? 0.16 : 0.28) {
  if (s.variant === 'lenia') return seedLenia(s);
  const w = s.width, h = s.height, d = s.depth;
  const bw = Math.max(3, Math.floor(w * (0.18 + Math.random() * 0.4)));
  const bh = Math.max(3, Math.floor(h * (0.18 + Math.random() * 0.4)));
  const bd = d === 1 ? 1 : Math.max(3, Math.floor(d * 0.65));
  const x0 = Math.floor(Math.random() * Math.max(1, w - bw));
  const y0 = Math.floor(Math.random() * Math.max(1, h - bh));
  const z0 = d === 1 ? 0 : Math.floor(Math.random() * Math.max(1, d - bd));
  let pop = s.population;
  for (let z = z0; z < z0 + bd; z++) {
    for (let r = y0; r < y0 + bh; r++) {
      for (let c = x0; c < x0 + bw; c++) {
        if (Math.random() < density) {
          const i = idx3(s, z, r, c);
          if (!s.cells[i]) {
            s.cells[i] = 1;
            s.age[i] = 1;
            pop++;
          }
        }
      }
    }
  }
  s.population = pop;
}

export function seedLenia(s: LifeState) {
  if (s.variant !== 'lenia') return;
  clearLife(s);
  const values = s.values!;
  const blobs = 5;
  for (let b = 0; b < blobs; b++) {
    const cx = Math.random() * s.width;
    const cy = Math.random() * s.height;
    const radius = Math.max(4, Math.min(s.width, s.height) * (0.05 + Math.random() * 0.08));
    for (let r = 0; r < s.height; r++) {
      for (let c = 0; c < s.width; c++) {
        const dx = Math.min(Math.abs(c - cx), s.width - Math.abs(c - cx));
        const dy = Math.min(Math.abs(r - cy), s.height - Math.abs(r - cy));
        const dist = Math.sqrt(dx * dx + dy * dy) / radius;
        if (dist > 1.2) continue;
        const v = Math.exp(-dist * dist * 2.8) * (0.45 + Math.random() * 0.25);
        values[r * s.width + c] = Math.min(1, values[r * s.width + c] + v);
      }
    }
  }
  refreshLeniaCells(s);
}

/**
 * Karakalpak-inspired ornamental stamp: 4-fold symmetric geometric motif at
 * a random position with a random size. Built by drawing a few rhomboid /
 * cross / hook strokes inside one quadrant and mirroring across both axes.
 */
export function seedQaraqalpaq(s: LifeState, sizeOpt?: number, cxOpt?: number, cyOpt?: number) {
  if (s.variant === 'lenia') return seedLenia(s);
  const w = s.width, h = s.height;
  const z = s.variant === 'life3d' ? Math.floor(s.depth / 2) : 0;
  const maxSize = Math.max(2, Math.floor(Math.min(w, h) / 2) - 1);
  const size = Math.min(sizeOpt ?? (3 + Math.floor(Math.random() * Math.max(2, maxSize - 2))), maxSize);
  const cx = cxOpt ?? Math.floor(size + Math.random() * Math.max(1, w - size * 2));
  const cy = cyOpt ?? Math.floor(size + Math.random() * Math.max(1, h - size * 2));
  const quad = new Uint8Array(size * size);
  const set = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    quad[y * size + x] = 1;
  };
  for (let i = 0; i < size; i++) set(i, size - 1 - i);
  const inner = Math.max(2, Math.floor(size * 0.55));
  for (let i = 0; i < inner; i++) set(i, inner - 1 - i);
  const hooks = 2 + Math.floor(Math.random() * 3);
  for (let k = 0; k < hooks; k++) {
    const hx = Math.floor(Math.random() * size);
    const hy = Math.floor(Math.random() * size);
    const len = 2 + Math.floor(Math.random() * Math.max(2, size / 3));
    const horiz = Math.random() < 0.5;
    for (let i = 0; i < len; i++) {
      if (horiz) set(hx + i, hy); else set(hx, hy + i);
    }
    for (let i = 0; i < Math.max(2, len / 2); i++) {
      if (horiz) set(hx + len, hy + i); else set(hx + i, hy + len);
    }
  }
  for (let i = 0; i < Math.max(2, size / 4); i++) { set(i, 0); set(0, i); }
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
        for (let dz = 0; dz < (s.variant === 'life3d' ? 3 : 1); dz++) {
          const zz = Math.min(s.depth - 1, z + dz - 1);
          const i = idx3(s, zz, py, px);
          if (!s.cells[i]) {
            s.cells[i] = 1;
            s.age[i] = 1;
            pop++;
          }
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
  if (s.variant === 'lenia') return seedLenia(s);
  const z = s.variant === 'life3d' ? Math.floor(s.depth / 2) : 0;
  const setCell = (i: number) => {
    if (!s.cells[i]) {
      s.cells[i] = 1;
      s.age[i] = 1;
      s.population++;
    }
  };
  const setWrapped = (r: number, c: number, zOffset = 0) => {
    const rr = ((r % s.height) + s.height) % s.height;
    const cc = ((c % s.width) + s.width) % s.width;
    const zz = ((z + zOffset) % s.depth + s.depth) % s.depth;
    setCell(idx3(s, zz, rr, cc));
  };
  if (kind === 'gliders') {
    for (let i = 0; i < 10; i++) {
      const r0 = Math.floor(Math.random() * s.height);
      const c0 = Math.floor(Math.random() * s.width);
      for (const [dr, dc] of GLIDER) {
        setWrapped(r0 + dr, c0 + dc, 0);
        if (s.variant === 'life3d' && Math.random() < 0.45) setWrapped(r0 + dr, c0 + dc, 1);
      }
    }
  } else {
    const r0 = Math.floor(s.height / 2 - 8);
    const c0 = Math.floor(s.width / 2 - 8);
    for (const [dr, dc] of PULSAR) {
      setWrapped(r0 + dr, c0 + dc, 0);
      if (s.variant === 'life3d') setWrapped(r0 + dr, c0 + dc, Math.random() < 0.5 ? -1 : 1);
    }
  }
}

export function toggleCell(s: LifeState, r: number, c: number, z = Math.floor(s.depth / 2)) {
  if (r < 0 || r >= s.height || c < 0 || c >= s.width) return;
  const i = idx3(s, Math.max(0, Math.min(s.depth - 1, z)), r, c);
  if (s.variant === 'lenia' && s.values) {
    const on = s.values[i] <= 0.12;
    s.values[i] = on ? 0.9 : 0;
    refreshLeniaCells(s);
    return;
  }
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
  if (s.variant === 'life3d') return stepLife3D(s);
  if (s.variant === 'lenia') return stepLenia(s);
  return stepLife2D(s);
}

function stepLife2D(s: LifeState) {
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
      const nv = alive ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
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

function stepLife3D(s: LifeState) {
  const { width: w, height: h, depth: d, cells, age } = s;
  const next = new Uint8Array(cells.length);
  const nextAge = new Uint16Array(cells.length);
  let pop = 0;
  for (let z = 0; z < d; z++) {
    const zL = z === 0 ? d - 1 : z - 1;
    const zR = z === d - 1 ? 0 : z + 1;
    for (let r = 0; r < h; r++) {
      const rUp = r === 0 ? h - 1 : r - 1;
      const rDn = r === h - 1 ? 0 : r + 1;
      for (let c = 0; c < w; c++) {
        const cL = c === 0 ? w - 1 : c - 1;
        const cR = c === w - 1 ? 0 : c + 1;
        let n = 0;
        for (const zz of [zL, z, zR]) {
          for (const rr of [rUp, r, rDn]) {
            for (const cc of [cL, c, cR]) {
              if (zz === z && rr === r && cc === c) continue;
              n += cells[idx3(s, zz, rr, cc)];
            }
          }
        }
        const i = idx3(s, z, r, c);
        const alive = cells[i] === 1;
        // Stable 3D Life family: birth on 5, survival on 4-6.
        const nv = alive ? (n >= 4 && n <= 6 ? 1 : 0) : (n === 5 ? 1 : 0);
        next[i] = nv;
        if (nv) {
          nextAge[i] = alive ? Math.min(age[i] + 1, 65535) : 1;
          pop++;
        }
      }
    }
  }
  s.cells = next;
  s.age = nextAge;
  s.generation++;
  s.population = pop;
}

function stepLenia(s: LifeState) {
  const { width: w, height: h, age } = s;
  const values = s.values!;
  let next = leniaScratch.get(s);
  if (!next || next.length !== values.length) {
    next = new Float32Array(values.length);
    leniaScratch.set(s, next);
  }
  const { radius, target, sigma, dt, ringCenter, ringWidth } = lifeSettings.lenia;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      let sum = 0;
      let weight = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const rr = (r + dy + h) % h;
        for (let dx = -radius; dx <= radius; dx++) {
          const cc = (c + dx + w) % w;
          const dist = Math.sqrt(dx * dx + dy * dy) / radius;
          if (dist > 1) continue;
          const k = Math.exp(-Math.pow((dist - ringCenter) / ringWidth, 2) * 0.5);
          sum += values[rr * w + cc] * k;
          weight += k;
        }
      }
      const u = weight > 0 ? sum / weight : 0;
      const growth = 2 * Math.exp(-Math.pow((u - target) / sigma, 2) * 0.5) - 1;
      const i = r * w + c;
      next[i] = Math.max(0, Math.min(1, values[i] + dt * growth));
    }
  }
  s.values = new Float32Array(next);
  refreshLeniaCells(s);
  s.generation++;
}

function refreshLeniaCells(s: LifeState) {
  const values = s.values;
  if (!values) return;
  let pop = 0;
  for (let i = 0; i < values.length; i++) {
    const alive = values[i] > 0.08;
    s.cells[i] = alive ? 1 : 0;
    if (alive) {
      s.age[i] = Math.min(s.age[i] + 1, 65535);
      pop++;
    } else {
      s.age[i] = 0;
    }
  }
  s.population = pop;
}

/* ── Tiny pub/sub so HUD <-> overlay can talk without prop drilling ── */
export type LifeColorMode = 'age' | 'surface' | 'bright';
export interface LifeSettings { cellSize: number; colorMode: LifeColorMode; variant: LifeVariant; }
const lifeSettings: LifeSettings = { cellSize: DEFAULT_LIFE_CELL_SIZE, colorMode: 'age', variant: DEFAULT_LIFE_VARIANT };
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
  | { type: 'variant'; variant: LifeVariant }
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
  if (e.type === 'variant') setLifeSettings({ variant: e.variant });
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
  variant?: LifeVariant;
  gridWidth?: number;
  gridHeight?: number;
  gridDepth?: number;
}
const statsListeners = new Set<(s: LifeStats) => void>();
export function onLifeStats(cb: (s: LifeStats) => void) {
  statsListeners.add(cb);
  return () => { statsListeners.delete(cb); };
}
export function emitLifeStats(s: LifeStats) {
  statsListeners.forEach(l => l(s));
}
