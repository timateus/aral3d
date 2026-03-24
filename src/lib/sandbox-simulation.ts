/**
 * Cellular automata sandbox simulation inspired by Sandspiel.
 * Elements interact with each other on a 2D grid overlaid on terrain.
 */

export type ElementType =
  | 'empty'
  | 'wall'    // immovable terrain
  | 'sand'
  | 'water'
  | 'stone'
  | 'plant'
  | 'fire'
  | 'gas'
  | 'dust'
  | 'wind'
  | 'ice'
  | 'oil'
  | 'lava'
  | 'seed';

export interface Cell {
  type: ElementType;
  life: number;      // for fire/plant decay
  velocity: number;  // for gravity effects
  updated: boolean;  // prevent double-processing per frame
}

export interface SandboxState {
  grid: Cell[];
  width: number;
  height: number;
  generation: number;
}

export const ELEMENT_COLORS: Record<ElementType, string> = {
  empty: 'transparent',
  wall: '#8B7355',
  sand: '#E8D68C',
  water: '#4A90D9',
  stone: '#808080',
  plant: '#2D8B2D',
  fire: '#FF4500',
  gas: '#C8E8C8',
  dust: '#D2B48C',
  wind: '#B0C4DE',
  ice: '#E0F0FF',
  oil: '#2B1B0E',
  lava: '#FF2200',
  seed: '#6B4226',
};

export const ELEMENT_RGB: Record<ElementType, [number, number, number]> = {
  empty: [0, 0, 0],
  wall: [139, 115, 85],
  sand: [232, 214, 140],
  water: [74, 144, 217],
  stone: [128, 128, 128],
  plant: [45, 139, 45],
  fire: [255, 69, 0],
  gas: [200, 232, 200],
  dust: [210, 180, 140],
  wind: [176, 196, 222],
  ice: [224, 240, 255],
  oil: [43, 27, 14],
  lava: [255, 34, 0],
  seed: [107, 66, 38],
};

function emptyCell(): Cell {
  return { type: 'empty', life: 0, velocity: 0, updated: false };
}

export function createSandbox(width: number, height: number, terrainElevations?: Float32Array, terrainW?: number, terrainH?: number): SandboxState {
  const grid: Cell[] = new Array(width * height);
  for (let i = 0; i < grid.length; i++) {
    grid[i] = emptyCell();
  }

  // If terrain data provided, fill bottom portion with wall cells based on elevation
  if (terrainElevations && terrainW && terrainH) {
    // Find min/max for normalization
    let minE = Infinity, maxE = -Infinity;
    for (let i = 0; i < terrainElevations.length; i++) {
      const e = terrainElevations[i];
      if (!isNaN(e) && e > -9999) {
        if (e < minE) minE = e;
        if (e > maxE) maxE = e;
      }
    }
    const range = maxE - minE || 1;

    for (let x = 0; x < width; x++) {
      // Sample terrain column
      const tx = Math.floor((x / width) * terrainW);
      // Take a horizontal slice through the middle of terrain
      const ty = Math.floor(terrainH / 2);
      const tIdx = ty * terrainW + Math.min(tx, terrainW - 1);
      const elev = terrainElevations[tIdx];
      const norm = isNaN(elev) || elev <= -9999 ? 0 : (elev - minE) / range;
      const wallHeight = Math.floor(norm * height * 0.4) + 1;

      for (let y = height - wallHeight; y < height; y++) {
        const idx = y * width + x;
        grid[idx] = { type: 'wall', life: 0, velocity: 0, updated: false };
      }
    }
  }

  return { grid, width, height, generation: 0 };
}

function idx(state: SandboxState, x: number, y: number): number {
  return y * state.width + x;
}

function inBounds(state: SandboxState, x: number, y: number): boolean {
  return x >= 0 && x < state.width && y >= 0 && y < state.height;
}

function get(state: SandboxState, x: number, y: number): Cell {
  return state.grid[idx(state, x, y)];
}

function swap(state: SandboxState, x1: number, y1: number, x2: number, y2: number) {
  const i1 = idx(state, x1, y1);
  const i2 = idx(state, x2, y2);
  const tmp = state.grid[i1];
  state.grid[i1] = state.grid[i2];
  state.grid[i2] = tmp;
  state.grid[i1].updated = true;
  state.grid[i2].updated = true;
}

function set(state: SandboxState, x: number, y: number, type: ElementType, life = 0) {
  const i = idx(state, x, y);
  state.grid[i] = { type, life, velocity: 0, updated: true };
}

function isEmpty(state: SandboxState, x: number, y: number): boolean {
  return inBounds(state, x, y) && state.grid[idx(state, x, y)].type === 'empty';
}

function isType(state: SandboxState, x: number, y: number, type: ElementType): boolean {
  return inBounds(state, x, y) && state.grid[idx(state, x, y)].type === type;
}

function isLiquid(type: ElementType): boolean {
  return type === 'water' || type === 'oil' || type === 'lava';
}

function isGas(type: ElementType): boolean {
  return type === 'gas' || type === 'wind';
}

export function stepSandbox(state: SandboxState): void {
  const { width, height, grid } = state;

  // Reset updated flags
  for (let i = 0; i < grid.length; i++) {
    grid[i].updated = false;
  }

  // Process bottom-to-top for gravity, alternating left/right scan
  const leftToRight = state.generation % 2 === 0;

  for (let y = height - 1; y >= 0; y--) {
    const startX = leftToRight ? 0 : width - 1;
    const endX = leftToRight ? width : -1;
    const stepX = leftToRight ? 1 : -1;

    for (let x = startX; x !== endX; x += stepX) {
      const cell = get(state, x, y);
      if (cell.updated || cell.type === 'empty' || cell.type === 'wall') continue;

      switch (cell.type) {
        case 'sand':
          updateSand(state, x, y);
          break;
        case 'water':
          updateWater(state, x, y);
          break;
        case 'stone':
          // Stone doesn't move but can be melted by lava
          if (neighborHas(state, x, y, 'lava') && Math.random() < 0.02) {
            set(state, x, y, 'lava', 100);
          }
          break;
        case 'plant':
          updatePlant(state, x, y);
          break;
        case 'fire':
          updateFire(state, x, y);
          break;
        case 'gas':
          updateGas(state, x, y);
          break;
        case 'dust':
          updateDust(state, x, y);
          break;
        case 'wind':
          updateWind(state, x, y);
          break;
        case 'ice':
          updateIce(state, x, y);
          break;
        case 'oil':
          updateOil(state, x, y);
          break;
        case 'lava':
          updateLava(state, x, y);
          break;
        case 'seed':
          updateSeed(state, x, y);
          break;
      }
    }
  }

  state.generation++;
}

function updateSand(s: SandboxState, x: number, y: number) {
  const below = y + 1;
  if (isEmpty(s, x, below) || (inBounds(s, x, below) && isLiquid(get(s, x, below).type))) {
    swap(s, x, y, x, below);
  } else {
    const dir = Math.random() < 0.5 ? -1 : 1;
    if (isEmpty(s, x + dir, below) || (inBounds(s, x + dir, below) && isLiquid(get(s, x + dir, below).type))) {
      swap(s, x, y, x + dir, below);
    } else if (isEmpty(s, x - dir, below) || (inBounds(s, x - dir, below) && isLiquid(get(s, x - dir, below).type))) {
      swap(s, x, y, x - dir, below);
    }
  }
}

function updateWater(s: SandboxState, x: number, y: number) {
  const below = y + 1;
  if (isEmpty(s, x, below)) {
    swap(s, x, y, x, below);
  } else if (isEmpty(s, x - 1, below)) {
    swap(s, x, y, x - 1, below);
  } else if (isEmpty(s, x + 1, below)) {
    swap(s, x, y, x + 1, below);
  } else {
    // Flow sideways
    const dir = Math.random() < 0.5 ? -1 : 1;
    if (isEmpty(s, x + dir, y)) {
      swap(s, x, y, x + dir, y);
    } else if (isEmpty(s, x - dir, y)) {
      swap(s, x, y, x - dir, y);
    }
  }

  // Evaporate near fire
  if (neighborHas(s, x, y, 'fire') && Math.random() < 0.15) {
    set(s, x, y, 'gas', 60);
  }

  // Freeze near ice
  if (neighborHas(s, x, y, 'ice') && Math.random() < 0.03) {
    set(s, x, y, 'ice', 0);
  }
}

function updatePlant(s: SandboxState, x: number, y: number) {
  // Grow upward if water nearby
  if (neighborHas(s, x, y, 'water') && Math.random() < 0.08) {
    // Consume water
    consumeNeighbor(s, x, y, 'water');
    // Try to grow up
    if (isEmpty(s, x, y - 1)) {
      set(s, x, y - 1, 'plant', 0);
    } else {
      const dir = Math.random() < 0.5 ? -1 : 1;
      if (isEmpty(s, x + dir, y - 1)) {
        set(s, x + dir, y - 1, 'plant', 0);
      }
    }
  }

  // Spread sideways slowly
  if (Math.random() < 0.01 && neighborHas(s, x, y, 'water')) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    if (isEmpty(s, x + dir, y)) {
      set(s, x + dir, y, 'plant', 0);
    }
  }
}

function updateFire(s: SandboxState, x: number, y: number) {
  const cell = get(s, x, y);
  cell.life--;

  if (cell.life <= 0) {
    // Die out, sometimes leave dust
    set(s, x, y, Math.random() < 0.3 ? 'dust' : 'empty');
    return;
  }

  // Rise
  if (Math.random() < 0.4 && isEmpty(s, x, y - 1)) {
    swap(s, x, y, x, y - 1);
  } else if (Math.random() < 0.2) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    if (isEmpty(s, x + dir, y - 1)) {
      swap(s, x, y, x + dir, y - 1);
    }
  }

  // Spread to flammable neighbors
  spreadFire(s, x, y);
}

function spreadFire(s: SandboxState, x: number, y: number) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const nx = x + dx, ny = y + dy;
    if (!inBounds(s, nx, ny)) continue;
    const n = get(s, nx, ny);
    if (n.type === 'plant' && Math.random() < 0.12) {
      set(s, nx, ny, 'fire', 30 + Math.floor(Math.random() * 20));
    }
    if (n.type === 'oil' && Math.random() < 0.3) {
      set(s, nx, ny, 'fire', 50 + Math.floor(Math.random() * 30));
    }
    if (n.type === 'dust' && Math.random() < 0.05) {
      set(s, nx, ny, 'fire', 15 + Math.floor(Math.random() * 10));
    }
    if (n.type === 'seed' && Math.random() < 0.15) {
      set(s, nx, ny, 'fire', 20);
    }
  }
}

function updateGas(s: SandboxState, x: number, y: number) {
  const cell = get(s, x, y);
  cell.life--;
  if (cell.life <= 0) {
    set(s, x, y, 'empty');
    return;
  }

  // Rise
  if (isEmpty(s, x, y - 1)) {
    swap(s, x, y, x, y - 1);
  } else {
    const dir = Math.random() < 0.5 ? -1 : 1;
    if (isEmpty(s, x + dir, y)) {
      swap(s, x, y, x + dir, y);
    } else if (isEmpty(s, x + dir, y - 1)) {
      swap(s, x, y, x + dir, y - 1);
    }
  }
}

function updateDust(s: SandboxState, x: number, y: number) {
  // Like sand but lighter, affected by wind
  if (neighborHas(s, x, y, 'wind')) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    if (isEmpty(s, x + dir, y) || isEmpty(s, x + dir, y - 1)) {
      const ty = isEmpty(s, x + dir, y - 1) ? y - 1 : y;
      swap(s, x, y, x + dir, ty);
      return;
    }
  }

  const below = y + 1;
  if (isEmpty(s, x, below)) {
    swap(s, x, y, x, below);
  } else {
    const dir = Math.random() < 0.5 ? -1 : 1;
    if (isEmpty(s, x + dir, below)) {
      swap(s, x, y, x + dir, below);
    }
  }
}

function updateWind(s: SandboxState, x: number, y: number) {
  const cell = get(s, x, y);
  cell.life--;
  if (cell.life <= 0) {
    set(s, x, y, 'empty');
    return;
  }

  // Move primarily sideways and up
  const dir = Math.random() < 0.5 ? -1 : 1;
  if (Math.random() < 0.6 && isEmpty(s, x + dir, y)) {
    swap(s, x, y, x + dir, y);
  } else if (Math.random() < 0.3 && isEmpty(s, x, y - 1)) {
    swap(s, x, y, x, y - 1);
  } else if (isEmpty(s, x + dir, y - 1)) {
    swap(s, x, y, x + dir, y - 1);
  }
}

function updateIce(s: SandboxState, x: number, y: number) {
  // Melt near fire or lava
  if (neighborHas(s, x, y, 'fire') || neighborHas(s, x, y, 'lava')) {
    set(s, x, y, 'water', 0);
    return;
  }
  // Ice is static but freezes adjacent water
  if (Math.random() < 0.02) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (isType(s, nx, ny, 'water') && Math.random() < 0.05) {
        set(s, nx, ny, 'ice', 0);
      }
    }
  }
}

function updateOil(s: SandboxState, x: number, y: number) {
  // Like water but floats on water
  const below = y + 1;
  if (isEmpty(s, x, below)) {
    swap(s, x, y, x, below);
  } else if (inBounds(s, x, below) && get(s, x, below).type === 'water') {
    // Don't sink in water — stay on top
    // Flow sideways instead
    const dir = Math.random() < 0.5 ? -1 : 1;
    if (isEmpty(s, x + dir, y)) swap(s, x, y, x + dir, y);
    else if (isEmpty(s, x - dir, y)) swap(s, x, y, x - dir, y);
  } else {
    const dir = Math.random() < 0.5 ? -1 : 1;
    if (isEmpty(s, x + dir, below)) swap(s, x, y, x + dir, below);
    else if (isEmpty(s, x - dir, below)) swap(s, x, y, x - dir, below);
    else if (isEmpty(s, x + dir, y)) swap(s, x, y, x + dir, y);
    else if (isEmpty(s, x - dir, y)) swap(s, x, y, x - dir, y);
  }
}

function updateLava(s: SandboxState, x: number, y: number) {
  const cell = get(s, x, y);
  cell.life--;
  if (cell.life <= 0) {
    set(s, x, y, 'stone', 0); // Solidifies
    return;
  }

  // Flow like water but slower
  const below = y + 1;
  if (Math.random() < 0.6) {
    if (isEmpty(s, x, below)) {
      swap(s, x, y, x, below);
    } else {
      const dir = Math.random() < 0.5 ? -1 : 1;
      if (isEmpty(s, x + dir, below)) swap(s, x, y, x + dir, below);
      else if (isEmpty(s, x + dir, y)) swap(s, x, y, x + dir, y);
    }
  }

  // Ignite nearby
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const nx = x + dx, ny = y + dy;
    if (!inBounds(s, nx, ny)) continue;
    const n = get(s, nx, ny);
    if (n.type === 'water') {
      set(s, nx, ny, 'stone', 0);
      set(s, x, y, 'stone', 0);
      return;
    }
    if (n.type === 'plant' && Math.random() < 0.3) {
      set(s, nx, ny, 'fire', 40);
    }
    if (n.type === 'ice') {
      set(s, nx, ny, 'water', 0);
    }
  }
}

function updateSeed(s: SandboxState, x: number, y: number) {
  // Falls like sand
  const below = y + 1;
  if (isEmpty(s, x, below)) {
    swap(s, x, y, x, below);
    return;
  }

  // When landed, grow into plant if water nearby
  const landed = !isEmpty(s, x, below);
  if (landed && neighborHas(s, x, y, 'water')) {
    set(s, x, y, 'plant', 0);
  }
}

function neighborHas(s: SandboxState, x: number, y: number, type: ElementType): boolean {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    if (isType(s, x + dx, y + dy, type)) return true;
  }
  return false;
}

function consumeNeighbor(s: SandboxState, x: number, y: number, type: ElementType) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    if (isType(s, x + dx, y + dy, type)) {
      set(s, x + dx, y + dy, 'empty');
      return;
    }
  }
}

export function paintElement(state: SandboxState, cx: number, cy: number, type: ElementType, radius: number = 3): void {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const x = cx + dx, y = cy + dy;
      if (!inBounds(state, x, y)) continue;
      const existing = get(state, x, y);
      if (existing.type === 'wall' && type !== 'empty') continue; // Can't overwrite walls unless erasing
      if (type === 'empty' || existing.type === 'empty' || (type === 'empty' && existing.type === 'wall')) {
        const life = type === 'fire' ? 40 + Math.floor(Math.random() * 30)
          : type === 'gas' ? 80 + Math.floor(Math.random() * 40)
          : type === 'wind' ? 60 + Math.floor(Math.random() * 40)
          : type === 'lava' ? 120 + Math.floor(Math.random() * 60)
          : 0;
        set(state, x, y, type, life);
      }
    }
  }
}

/**
 * Render the sandbox state to an ImageData for canvas drawing.
 */
export function renderToImageData(state: SandboxState, imageData: ImageData): void {
  const { grid, width, height } = state;
  const data = imageData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const cell = grid[i];
      const pi = i * 4;

      if (cell.type === 'empty') {
        data[pi] = 240; data[pi + 1] = 232; data[pi + 2] = 220; data[pi + 3] = 255;
        continue;
      }

      const [r, g, b] = ELEMENT_RGB[cell.type];

      // Add variation
      const v = (Math.sin(x * 0.3 + y * 0.7 + state.generation * 0.01) * 10) | 0;
      data[pi] = Math.max(0, Math.min(255, r + v));
      data[pi + 1] = Math.max(0, Math.min(255, g + v));
      data[pi + 2] = Math.max(0, Math.min(255, b + v));
      data[pi + 3] = 255;

      // Special: fire flicker
      if (cell.type === 'fire') {
        const flicker = Math.floor(Math.random() * 80);
        data[pi] = Math.min(255, r + flicker);
        data[pi + 1] = Math.min(255, g + flicker / 2);
      }

      // Special: water shimmer
      if (cell.type === 'water') {
        const shimmer = Math.sin(x * 0.5 + state.generation * 0.15) * 15;
        data[pi + 2] = Math.min(255, b + shimmer);
      }

      // Special: lava glow
      if (cell.type === 'lava') {
        const glow = Math.sin(state.generation * 0.2 + x * 0.3) * 40;
        data[pi] = Math.min(255, r + glow);
        data[pi + 1] = Math.max(0, g + glow * 0.5);
      }
    }
  }
}
