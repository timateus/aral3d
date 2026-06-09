import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { loadGeoTiff, type TerrainData } from '@/lib/geotiff-loader';
import { buildVoxelWorld, type VoxelWorld } from '@/lib/voxel/voxel-world';
import { useVoxelInventory } from '@/hooks/useVoxelInventory';
import { useVoxelStats, getStatsSnapshot, setStatsRaw } from '@/hooks/useVoxelStats';
import { useVoxelMissions, dispatchMissionEvent } from '@/hooks/useVoxelMissions';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Volume2, VolumeX, Sun, Moon, Play, Square } from 'lucide-react';
import VoxelTerrain from '@/components/voxel/VoxelTerrain';
import VoxelPlayer from '@/components/voxel/VoxelPlayer';
import VoxelHUD from '@/components/voxel/VoxelHUD';
import VoxelInventoryPanel from '@/components/voxel/VoxelInventoryPanel';
import VoxelBuildMenu from '@/components/voxel/VoxelBuildMenu';
import VoxelQuestLog from '@/components/voxel/VoxelQuestLog';
import VoxelStatsHUD from '@/components/voxel/VoxelStatsHUD';
import Camels from '@/components/voxel/Camels';
import Sheep from '@/components/voxel/Sheep';
import Fish from '@/components/voxel/Fish';
import Fox from '@/components/voxel/Fox';
import DustDevil from '@/components/voxel/DustDevil';
import VoxelMinimap from '@/components/voxel/VoxelMinimap';
import VoxelPlaceTags from '@/components/voxel/VoxelPlaceTags';
import VoxelTouchControls from '@/components/voxel/VoxelTouchControls';
import VoxelAutopilot from '@/components/voxel/VoxelAutopilot';
import { initAudio, playSfx, startAmbient, stopAmbient, setMuted, isMuted } from '@/lib/voxel/voxel-audio';
import { createSaplingTracker, type SaplingTracker } from '@/lib/voxel/saxaul';
import { floodFillCanal } from '@/lib/voxel/water-fill';
import { tickWaterFlow } from '@/lib/voxel/water-flow';
import { STRUCTURES, placeStructure } from '@/lib/voxel/structures';
import type { BlockId } from '@/lib/voxel/block-types';
import { useThree } from '@react-three/fiber';
import { loadWorldDiff, saveWorldDiff, applyDiff, snapshotColumn, type WorldDiff } from '@/lib/voxel/world-persistence';

type RegionKey = 'khorezm' | 'aral';

const REGIONS: Record<RegionKey, { label: string; file: string; waterLevel: number; fog: [string, number, number]; hasDust: boolean }> = {
  khorezm: { label: 'Khorezm Oasis', file: '/data/khorezm.tif', waterLevel: 53, fog: ['#aac3d6', 80, 260], hasDust: false },
  aral:    { label: 'Aral Sea',      file: '/data/aral_region.tif', waterLevel: 32, fog: ['#d4c9a8', 70, 240], hasDust: true },
};

const DAY_LENGTH_SEC = 480; // 8 minutes

// Sun + sky controller — animates directional light + ambient + bg color over time-of-day.
const Sun3D = ({ timeRef, regionFog }: { timeRef: React.MutableRefObject<number>; regionFog: [string, number, number] }) => {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const dayCol = useMemo(() => new THREE.Color(regionFog[0]), [regionFog]);
  const duskCol = useMemo(() => new THREE.Color('#c97a4a'), []);
  const nightCol = useMemo(() => new THREE.Color('#0a0e1c'), []);

  useFrame((state) => {
    timeRef.current = (state.clock.elapsedTime % DAY_LENGTH_SEC) / DAY_LENGTH_SEC; // 0..1
    const t = timeRef.current;
    const ang = t * Math.PI * 2 - Math.PI / 2;
    const sunY = Math.sin(ang);
    const sunX = Math.cos(ang);
    if (lightRef.current) {
      lightRef.current.position.set(sunX * 100, sunY * 80, 40);
      lightRef.current.intensity = Math.max(0.05, sunY * 1.2);
    }
    if (ambientRef.current) {
      ambientRef.current.intensity = 0.25 + Math.max(0, sunY) * 0.4;
    }
    // Sky/fog color tint
    const isNight = sunY < 0;
    const tint = isNight ? nightCol : (sunY < 0.2 ? duskCol : dayCol);
    const lerpAmt = isNight ? 1 : (sunY < 0.2 ? 1 - sunY / 0.2 : 0);
    const base = dayCol.clone().lerp(tint, Math.min(1, lerpAmt));
    state.scene.background = base;
    if (state.scene.fog && state.scene.fog instanceof THREE.Fog) {
      state.scene.fog.color.copy(base);
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.55} />
      <directionalLight ref={lightRef} position={[60, 120, 40]} intensity={1.1} color={'#fff5e0'} />
      <hemisphereLight args={['#c8dbef', '#5a3e22', 0.35]} />
    </>
  );
};

// Sapling growth + canal flood + water-flow tick
const WorldTicker = ({ world, saplingsRef, regionWaterBlocks, onWorldMutated }: {
  world: VoxelWorld;
  saplingsRef: React.MutableRefObject<SaplingTracker>;
  regionWaterBlocks: number;
  onWorldMutated: () => void;
}) => {
  const last = useRef(0);
  const lastFlow = useRef(0);
  useFrame((state) => {
    const now = state.clock.elapsedTime * 1000;
    let dirty = false;
    if (now - lastFlow.current > 700) {
      lastFlow.current = now;
      if (tickWaterFlow(world, 60) > 0) dirty = true;
    }
    if (now - last.current >= 1000) {
      last.current = now;
      if (saplingsRef.current.tick(world, performance.now())) dirty = true;
      const mature = saplingsRef.current.countMature();
      if (mature > 0) dispatchMissionEvent({ type: 'mature-saxaul', count: mature });
    }
    if (dirty) onWorldMutated();
  });
  return null;
};

// Zoom controller: listens to 'voxel:zoom' events from VoxelPlayer (R2/L2) and
// adjusts perspective camera FOV smoothly.
const ZoomController = () => {
  const { camera } = useThree();
  const targetFov = useRef<number>((camera as THREE.PerspectiveCamera).fov ?? 75);
  useEffect(() => {
    const onZoom = (e: Event) => {
      const { delta } = (e as CustomEvent<{ delta: number }>).detail;
      // delta>0 means R2 pressed = zoom in (lower fov)
      targetFov.current = Math.max(28, Math.min(95, targetFov.current - delta * 30));
    };
    window.addEventListener('voxel:zoom', onZoom);
    return () => window.removeEventListener('voxel:zoom', onZoom);
  }, []);
  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (!cam.isPerspectiveCamera) return;
    const next = cam.fov + (targetFov.current - cam.fov) * 0.18;
    if (Math.abs(next - cam.fov) > 0.05) {
      cam.fov = next;
      cam.updateProjectionMatrix();
    }
  });
  return null;
};


const VoxelPage = () => {
  const [region, setRegion] = useState<RegionKey>('khorezm');
  const [terrain, setTerrain] = useState<TerrainData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [locked, setLocked] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const [questOpen, setQuestOpen] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const ACTION_LIMIT = 50;
  // Action budget is per visit to the level: starts at 50 every time the page mounts,
  // and only PLACING blocks decrements it. Breaking is free. Reset happens on unmount.
  const [actionsLeft, setActionsLeft] = useState<number>(ACTION_LIMIT);
  const actionsRef = useRef(actionsLeft);
  actionsRef.current = actionsLeft;
  const canAct = useCallback(() => actionsRef.current > 0, []);
  const onActionConsumed = useCallback((kind: 'break' | 'place') => {
    if (kind !== 'place') return; // breaking is free
    setActionsLeft((n) => Math.max(0, n - 1));
  }, []);
  // Reset on unmount (i.e., when the user exits the level).
  useEffect(() => () => { try { localStorage.removeItem('voxel_actions_left_v1'); } catch {} }, []);
  const inv = useVoxelInventory();
  const stats = useVoxelStats();
  useVoxelMissions(); // mount the listener
  const selectedRef = useRef(inv.selected);
  selectedRef.current = inv.selected;
  const hotbarRef = useRef(inv.hotbar);
  hotbarRef.current = inv.hotbar;
  const playerRef = useRef({ x: 0, z: 0, yaw: 0 });
  const timeRef = useRef(0.3);
  const saplingsRef = useRef(createSaplingTracker());

  useEffect(() => {
    document.title = `Survive — ${REGIONS[region].label}`;
    setTerrain(null);
    setError(null);
    saplingsRef.current = createSaplingTracker();
    loadGeoTiff(REGIONS[region].file)
      .then(setTerrain)
      .catch((e) => setError(String(e?.message ?? e)));
  }, [region]);

  const world: VoxelWorld | null = useMemo(() => {
    if (!terrain) return null;
    return buildVoxelWorld(terrain, {
      targetWidth: 160,
      targetDepth: 160,
      blockHeightMeters: 4,
      verticalExaggeration: 2.5,
      waterLevelMeters: REGIONS[region].waterLevel,
    });
  }, [terrain, region]);

  // The water-level expressed in voxel block-y.
  const waterLevelBlocks = useMemo(() => {
    if (!world || !terrain) return 0;
    // Reproduce mapping from voxel-world.ts: round(((elev - minElev) * vexag) / blockMeters) + 1
    // For canal fill we approximate with sea-level mapped using minElevation observed in heights.
    // Simpler: use the median height as proxy — but for sea region, water-level ≈ median of water columns.
    const waterId = world.idIndex.get('water');
    let sum = 0, count = 0;
    for (let i = 0; i < world.heights.length; i++) {
      const h = world.heights[i];
      if (h === 0) continue;
      const top = world.cells[i * world.maxStackHeight + h - 1];
      if (top === waterId) { sum += h; count++; }
    }
    return count > 0 ? Math.round(sum / count) : 4;
  }, [world]);

  const onMined = useCallback((block: string) => {
    inv.add(block as any, 1);
    playSfx('mine');
    const extras: string[] = [];
    if (block === 'saxaul' && Math.random() < 0.6) { inv.add('ash' as any, 1); extras.push('+1 ash'); }
    if (block === 'saxaul' && Math.random() < 0.3) { inv.add('fat' as any, 1); extras.push('+1 fat'); }
    if (block === 'reed' && Math.random() < 0.3) { inv.add('grass' as any, 1); extras.push('+1 grass'); }
    if (block === 'reed' && Math.random() < 0.2) { inv.add('flatbread' as any, 1); extras.push('+1 flatbread'); }
    const label = block.charAt(0).toUpperCase() + block.slice(1);
    toast.success(`+1 ${label}${extras.length ? ' · ' + extras.join(' · ') : ''}`, { duration: 1400 });
  }, [inv]);

  // After mining, trigger canal flood if dug column is in canal zone.
  const onWorldMutated = useCallback(() => {
    setVersion(v => v + 1);
  }, []);

  const onMinedWithCanal = useCallback((block: string) => {
    onMined(block);
    if (!world) return;
    // Use player position to seed canal fill
    const halfW = world.width / 2, halfD = world.depth / 2;
    const i = Math.floor(playerRef.current.x + halfW);
    const j = Math.floor(playerRef.current.z + halfD);
    setTimeout(() => {
      const filled = floodFillCanal(world, i, j, waterLevelBlocks, 200);
      if (filled > 0) {
        dispatchMissionEvent({ type: 'canal-fill', cells: filled });
        toast.success(`Canal filled +${filled} cells`);
        setVersion(v => v + 1);
      }
    }, 300);
  }, [onMined, world, waterLevelBlocks]);

  const getSelectedBlock = useCallback(() => {
    const slot = hotbarRef.current[selectedRef.current];
    return slot?.block ?? null;
  }, []);

  const consumeSelected = useCallback(() => {
    const r = inv.useSelected();
    if (r) playSfx('place');
    return r;
  }, [inv]);

  const onMilked = useCallback(() => {
    inv.add('milk' as any, 1);
    if (Math.random() < 0.3) {
      inv.add('fat' as any, 1);
      toast.success('Camel milked → 1× Milk + 1× Fat');
    } else {
      toast.success('Camel milked → 1× Milk');
    }
    playSfx('milk');
    dispatchMissionEvent({ type: 'milk' });
  }, [inv]);

  const onShear = useCallback(() => {
    inv.add('fat' as any, 1);
    toast.success('Sheared → 1× Fat');
    playSfx('milk');
  }, [inv]);

  // Track sapling plantings from VoxelPlayer
  useEffect(() => {
    const onPlanted = (e: Event) => {
      const { i, j } = (e as CustomEvent<{ i: number; j: number }>).detail;
      saplingsRef.current.plant(i, j);
    };
    window.addEventListener('voxel:sapling-planted', onPlanted);
    return () => window.removeEventListener('voxel:sapling-planted', onPlanted);
  }, []);

  // Try-eat handler (consume flatbread/milk/fish on F when not near water)
  useEffect(() => {
    const onEat = () => {
      const order: BlockId[] = ['flatbread', 'fish', 'milk'];
      for (const food of order) {
        const slot = hotbarRef.current.find(s => s.block === food);
        if (slot && slot.count > 0) {
          slot.count--; if (slot.count === 0) slot.block = null;
          const gain = food === 'flatbread' ? 40 : food === 'fish' ? 25 : 10;
          const s = getStatsSnapshot();
          setStatsRaw({ hunger: s.hunger + gain });
          if (food === 'milk') setStatsRaw({ thirst: s.thirst + 10 });
          playSfx('eat');
          toast.success(`Ate ${food} (+${gain} hunger)`);
          try { localStorage.setItem('voxel_inventory_v1', JSON.stringify({ hotbar: hotbarRef.current, selected: selectedRef.current })); } catch {}
          return;
        }
      }
    };
    window.addEventListener('voxel:try-eat', onEat);
    return () => window.removeEventListener('voxel:try-eat', onEat);
  }, []);

  // HUD hotkeys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { setInvOpen(false); setBuildOpen(false); setQuestOpen(false); }
    };
    const onToggleQ = () => setQuestOpen(o => !o);
    const onToggleB = () => setBuildOpen(o => !o);
    window.addEventListener('keydown', onKey);
    window.addEventListener('voxel:toggle-quests', onToggleQ);
    window.addEventListener('voxel:toggle-build', onToggleB);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('voxel:toggle-quests', onToggleQ);
      window.removeEventListener('voxel:toggle-build', onToggleB);
    };
  }, []);

  // Audio
  useEffect(() => {
    const start = () => { initAudio(); startAmbient(); };
    window.addEventListener('pointerdown', start, { once: true });
    window.addEventListener('keydown', start, { once: true });
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
      stopAmbient();
    };
  }, []);

  // Stat tick (thirst + hunger drain)
  useEffect(() => {
    const id = setInterval(() => {
      const s = getStatsSnapshot();
      // Faster thirst drain on Aral salt flats
      const thirstDrain = region === 'aral' ? 0.6 : 0.4;
      setStatsRaw({
        thirst: s.thirst - thirstDrain,
        hunger: s.hunger - 0.3,
        stamina: Math.min(100, s.stamina + 0.5),
      });
    }, 1000);
    return () => clearInterval(id);
  }, [region]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  // Build menu handler
  const onBuild = useCallback((id: string) => {
    if (!world) return;
    const s = STRUCTURES.find(x => x.id === id);
    if (!s) return;
    if (!inv.craft(s.cost)) {
      toast.error('Missing materials');
      return;
    }
    const halfW = world.width / 2, halfD = world.depth / 2;
    const i = Math.floor(playerRef.current.x + halfW);
    const j = Math.floor(playerRef.current.z + halfD);
    if (placeStructure(world, i, j, s)) {
      playSfx('build');
      toast.success(`Built ${s.name}`);
      dispatchMissionEvent({ type: 'place-structure', id: s.id });
      setVersion(v => v + 1);
    }
  }, [world, inv]);

  // Demo autopilot picks a random structure and grants the materials so it can always build.
  const onDemoBuild = useCallback(() => {
    if (!world) return;
    const s = STRUCTURES[Math.floor(Math.random() * STRUCTURES.length)];
    for (const c of s.cost) inv.add(c.block as any, c.count);
    if (!inv.craft(s.cost)) return;
    const halfW = world.width / 2, halfD = world.depth / 2;
    const i = Math.floor(playerRef.current.x + halfW);
    const j = Math.floor(playerRef.current.z + halfD);
    if (placeStructure(world, i, j, s)) {
      playSfx('build');
      toast.success(`Demo built ${s.name}`);
      dispatchMissionEvent({ type: 'place-structure', id: s.id });
      setVersion(v => v + 1);
    }
  }, [world, inv]);


  const counts: Partial<Record<BlockId, number>> = {};
  for (const sl of inv.hotbar) if (sl.block) counts[sl.block] = (counts[sl.block] ?? 0) + sl.count;

  const cfg = REGIONS[region];

  return (
    <div className="fixed inset-0 bg-[#0c0f14] text-white font-mono">
      <div className="fixed top-3 left-3 z-50 flex items-center gap-1.5">
        <Link
          to="/"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-black/60 border border-white/20 text-[10px] uppercase tracking-widest hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> Exit Survive
        </Link>
        <Link
          to="/?level=6"
          className="px-3 py-1.5 bg-black/60 border border-white/20 text-[10px] uppercase tracking-widest hover:bg-white/10 transition-colors"
          title="Previous level: Kegeyli School 12"
        >
          ← prev · L6
        </Link>
        <Link
          to="/?level=1"
          className="px-3 py-1.5 bg-black/60 border border-white/20 text-[10px] uppercase tracking-widest hover:bg-white/10 transition-colors"
          title="Next level: Choose your character"
        >
          next · L1 →
        </Link>
      </div>

      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1">
        <div className="flex bg-black/60 border border-white/20">
          {(Object.keys(REGIONS) as RegionKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setRegion(k)}
              className={`px-3 py-1.5 text-[10px] uppercase tracking-widest transition-colors ${
                region === k ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {REGIONS[k].label}
            </button>
          ))}
        </div>
        <button onClick={toggleMute} className="px-2 py-1.5 bg-black/60 border border-white/20 hover:bg-white/10 transition-colors">
          {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => setDemoMode(d => !d)}
          className={`px-3 py-1.5 border text-[10px] uppercase tracking-widest flex items-center gap-1.5 transition-colors ${
            demoMode
              ? 'bg-emerald-500/30 border-emerald-300 text-emerald-100'
              : 'bg-black/60 border-white/20 text-white/80 hover:bg-white/10'
          }`}
          title="Auto-play demo"
        >
          {demoMode ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {demoMode ? 'Stop Demo' : 'Demo'}
        </button>
        <div className="px-2 py-1.5 bg-black/60 border border-white/20 flex items-center gap-1 text-[10px]">
          {timeRef.current > 0.25 && timeRef.current < 0.75 ? <Sun className="w-3 h-3 text-amber-300" /> : <Moon className="w-3 h-3 text-sky-200" />}
          <span className="text-white/70">Day {Math.round(timeRef.current * 24).toString().padStart(2, '0')}:00</span>
        </div>
      </div>

      {!world && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
          <Loader2 className="w-6 h-6 animate-spin" />
          <div className="text-[10px] uppercase tracking-widest">Generating {cfg.label} voxel world…</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm">
          Failed to load terrain: {error}
        </div>
      )}

      {world && (
        <Canvas
          key={region}
          shadows={false}
          dpr={[1, 1.5]}
          camera={{ fov: 75, near: 0.1, far: 600 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <color attach="background" args={[cfg.fog[0]]} />
          <fog attach="fog" args={cfg.fog} />

          <Sun3D timeRef={timeRef} regionFog={cfg.fog} />
          <WorldTicker world={world} saplingsRef={saplingsRef} regionWaterBlocks={waterLevelBlocks} onWorldMutated={onWorldMutated} />

          <VoxelTerrain world={world} version={version} />
          <Camels world={world} count={12} onMilked={onMilked} />
          <Sheep world={world} count={8} onShear={onShear} />
          <Fox world={world} count={5} />
          <Fish world={world} count={120} />
          {cfg.hasDust && <DustDevil world={world} enabled />}

          <VoxelPlayer
            world={world}
            onWorldMutated={onWorldMutated}
            onMined={onMinedWithCanal}
            getSelectedBlock={getSelectedBlock}
            consumeSelected={consumeSelected}
            onLockChange={setLocked}
            playerRef={playerRef}
            canAct={canAct}
            onActionConsumed={onActionConsumed}
          />
          <ZoomController />
          <VoxelAutopilot world={world} active={demoMode} onBuild={onDemoBuild} />
        </Canvas>
      )}

      {world && <VoxelMinimap world={world} playerRef={playerRef} version={version} label={`Map · ${cfg.label}`} />}
      {world && <VoxelPlaceTags world={world} playerRef={playerRef} region={region} />}

      {world && (
        <div className="fixed top-3 right-3 z-50 flex items-center gap-1.5">
          <div className={`px-3 py-1.5 border text-[10px] uppercase tracking-widest font-mono ${
            actionsLeft === 0
              ? 'bg-red-900/70 border-red-300 text-red-100 animate-pulse'
              : actionsLeft <= 10
                ? 'bg-amber-900/70 border-amber-300 text-amber-100'
                : 'bg-black/60 border-white/20 text-white/80'
          }`}>
            Actions {actionsLeft}/{ACTION_LIMIT}
          </div>
        </div>
      )}

      <VoxelHUD locked={locked} onOpenInventory={() => setInvOpen(o => !o)} />
      <VoxelTouchControls />
      {world && <VoxelStatsHUD />}
      <VoxelInventoryPanel open={invOpen} onClose={() => setInvOpen(false)} />
      <VoxelBuildMenu open={buildOpen} onClose={() => setBuildOpen(false)} counts={counts} onBuild={onBuild} />
      <VoxelQuestLog open={questOpen} onClose={() => setQuestOpen(false)} />
    </div>
  );
};

export default VoxelPage;
