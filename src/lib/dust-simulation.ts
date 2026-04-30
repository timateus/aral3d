/**
 * Particle-based dust storm simulation.
 *
 * Particles are spawned from emitters (former-seabed pixels), advected by a
 * uniform wind field plus turbulence and a small upward lift, then deposited
 * (faded out) when their lifetime ends. Position storage is a flat
 * Float32Array (x,y,z, vx,vy,vz, age, life) for performance.
 */
import type { TerrainData } from '@/lib/geotiff-loader';

export const DUST_STRIDE = 8; // x,y,z, vx,vy,vz, age, life

export interface DustEmitter {
  // terrain grid coordinates
  row: number;
  col: number;
  // world-space position (already projected) for fast spawn
  x: number;
  z: number; // ground height in world space
  radius: number; // world radius for jitter
  rate: number; // particles per second per emitter
}

export interface DustState {
  // particle storage (struct-of-arrays packed)
  data: Float32Array;
  alive: Uint8Array;
  capacity: number;
  count: number;
  // wind + dynamics
  windDir: number; // radians, 0 = +X (east)
  windSpeed: number; // world units / sec
  turbulence: number; // 0..1
  lift: number; // upward bias
  particleLife: number; // seconds
  spawnRate: number; // per second (global multiplier)
  // emitters
  emitters: DustEmitter[];
  // accumulated spawn budget across emitters
  spawnAccum: number;
  generation: number;
}

export interface DustParams {
  capacity?: number;
  windDir?: number;
  windSpeed?: number;
  turbulence?: number;
  lift?: number;
  particleLife?: number;
  spawnRate?: number;
}

export function createDustState(params: DustParams = {}): DustState {
  const capacity = params.capacity ?? 6000;
  return {
    data: new Float32Array(capacity * DUST_STRIDE),
    alive: new Uint8Array(capacity),
    capacity,
    count: 0,
    windDir: params.windDir ?? Math.PI * 0.85, // roughly NW→SE wind
    windSpeed: params.windSpeed ?? 1.4,
    turbulence: params.turbulence ?? 0.35,
    lift: params.lift ?? 0.25,
    particleLife: params.particleLife ?? 6,
    spawnRate: params.spawnRate ?? 200,
    emitters: [],
    spawnAccum: 0,
    generation: 0,
  };
}

export function clearDust(state: DustState) {
  state.alive.fill(0);
  state.count = 0;
  state.spawnAccum = 0;
  state.generation++;
}

export function clearEmitters(state: DustState) {
  state.emitters = [];
}

/**
 * Compute world-space (x,z planar) coordinates from terrain grid index.
 * Mirrors SandboxOverlay/TerrainMesh layout (10 units wide).
 */
function terrainToWorld(terrain: TerrainData, row: number, col: number): { x: number; y: number; ground: number } {
  const x = (col / (terrain.width - 1) - 0.5) * 10;
  const y = (0.5 - row / (terrain.height - 1)) * 10 * (terrain.height / terrain.width);
  // Note: in TerrainViewer the terrain mesh is rotated -PI/2 around X, so
  // overlay components (SandboxOverlay) use Z = elevation. We emit in that
  // rotated frame: the overlay <mesh> applies the same rotation.
  const idx = row * terrain.width + col;
  let elev = terrain.elevations[idx];
  if (isNaN(elev) || elev <= -9999) elev = terrain.minElevation;
  return { x, y, ground: elev };
}

export function addEmitter(
  state: DustState,
  terrain: TerrainData,
  row: number,
  col: number,
  radius = 0.4,
  rate = 80,
) {
  const { x, y, ground } = terrainToWorld(terrain, row, col);
  // Translate ground elevation to overlay world-Z (same scale as SandboxOverlay)
  state.emitters.push({ row, col, x, z: ground, radius, rate });
  // Stash the planar y in a hidden field via row/col; we recompute on spawn.
  // (We keep emitter struct minimal; spawn uses terrain to find y.)
  void y;
}

/**
 * Auto-seed emitters across the former Aral seabed: any pixel below the
 * given seabed elevation threshold (in meters) becomes a potential emitter.
 * We sample sparsely to keep the count manageable.
 */
export function autoSeedAralkum(
  state: DustState,
  terrain: TerrainData,
  seabedThreshold = 53,
  step = 14,
  rate = 25,
) {
  clearEmitters(state);
  const { width, height, elevations } = terrain;
  for (let r = 4; r < height - 4; r += step) {
    for (let c = 4; c < width - 4; c += step) {
      const idx = r * width + c;
      const e = elevations[idx];
      if (isNaN(e) || e <= -9999) continue;
      // Aralkum: dry seabed roughly between -5m and seabedThreshold (m a.s.l.)
      if (e < seabedThreshold && e > -10) {
        addEmitter(state, terrain, r, c, 0.5, rate);
      }
    }
  }
}

function spawnParticle(state: DustState, terrain: TerrainData, em: DustEmitter) {
  // Find a free slot
  let slot = -1;
  for (let i = 0; i < state.capacity; i++) {
    if (!state.alive[i]) { slot = i; break; }
  }
  if (slot < 0) return;
  const base = slot * DUST_STRIDE;
  const jitterX = (Math.random() - 0.5) * em.radius;
  const jitterY = (Math.random() - 0.5) * em.radius;
  const { y } = terrainToWorld(terrain, em.row, em.col);
  state.data[base + 0] = em.x + jitterX;            // x
  state.data[base + 1] = y + jitterY;               // y (planar)
  state.data[base + 2] = em.z + 0.05 + Math.random() * 0.1; // z = elevation + lift
  state.data[base + 3] = 0;                          // vx
  state.data[base + 4] = 0;                          // vy
  state.data[base + 5] = 0;                          // vz
  state.data[base + 6] = 0;                          // age
  state.data[base + 7] = state.particleLife * (0.6 + Math.random() * 0.8); // life
  state.alive[slot] = 1;
  state.count++;
}

export function stepDust(state: DustState, terrain: TerrainData, dt: number) {
  state.generation++;

  // --- spawn ---
  const totalRate = state.emitters.reduce((s, e) => s + e.rate, 0) * (state.spawnRate / 100);
  state.spawnAccum += totalRate * dt;
  let toSpawn = Math.floor(state.spawnAccum);
  state.spawnAccum -= toSpawn;
  while (toSpawn > 0 && state.emitters.length > 0 && state.count < state.capacity) {
    const em = state.emitters[(Math.random() * state.emitters.length) | 0];
    spawnParticle(state, terrain, em);
    toSpawn--;
  }

  // --- advect ---
  const wx = Math.cos(state.windDir) * state.windSpeed;
  const wy = Math.sin(state.windDir) * state.windSpeed;
  const turb = state.turbulence;
  const lift = state.lift;
  const drag = 0.92;

  for (let i = 0; i < state.capacity; i++) {
    if (!state.alive[i]) continue;
    const b = i * DUST_STRIDE;
    state.data[b + 6] += dt;
    if (state.data[b + 6] >= state.data[b + 7]) {
      state.alive[i] = 0;
      state.count--;
      continue;
    }
    // Wind force + turbulence
    const tx = (Math.random() - 0.5) * turb * 4;
    const ty = (Math.random() - 0.5) * turb * 4;
    const tz = (Math.random() - 0.3) * turb * 1.5;
    state.data[b + 3] = state.data[b + 3] * drag + (wx + tx) * dt * 4;
    state.data[b + 4] = state.data[b + 4] * drag + (wy + ty) * dt * 4;
    state.data[b + 5] = state.data[b + 5] * drag + (lift + tz) * dt * 1.5;
    // Integrate
    state.data[b + 0] += state.data[b + 3] * dt;
    state.data[b + 1] += state.data[b + 4] * dt;
    state.data[b + 2] += state.data[b + 5] * dt;
  }
}

/** Helper for HUD: count alive particles cheaply */
export function aliveCount(state: DustState): number {
  return state.count;
}
