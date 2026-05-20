import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import { Link } from 'react-router-dom';
import { loadGeoTiff, type TerrainData } from '@/lib/geotiff-loader';
import { buildVoxelWorld, type VoxelWorld } from '@/lib/voxel/voxel-world';
import { useVoxelInventory } from '@/hooks/useVoxelInventory';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Volume2, VolumeX } from 'lucide-react';
import VoxelTerrain from '@/components/voxel/VoxelTerrain';
import VoxelPlayer from '@/components/voxel/VoxelPlayer';
import VoxelHUD from '@/components/voxel/VoxelHUD';
import VoxelInventoryPanel from '@/components/voxel/VoxelInventoryPanel';
import Camels from '@/components/voxel/Camels';
import VoxelMinimap from '@/components/voxel/VoxelMinimap';
import { initAudio, playSfx, startAmbient, stopAmbient, setMuted, isMuted } from '@/lib/voxel/voxel-audio';

type RegionKey = 'khorezm' | 'aral';

const REGIONS: Record<RegionKey, { label: string; file: string; waterLevel: number; sky: string; fog: [string, number, number] }> = {
  khorezm: {
    label: 'Khorezm Oasis',
    file: '/data/khorezm.tif',
    waterLevel: 53,
    sky: '#aac3d6',
    fog: ['#aac3d6', 80, 260],
  },
  aral: {
    label: 'Aral Sea',
    file: '/data/aral_region.tif',
    waterLevel: 32, // exposes the dry Aralkum seabed + salt flats
    sky: '#d4c9a8',
    fog: ['#d4c9a8', 70, 240],
  },
};

const VoxelPage = () => {
  const [region, setRegion] = useState<RegionKey>('khorezm');
  const [terrain, setTerrain] = useState<TerrainData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [locked, setLocked] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [muted, setMutedState] = useState(false);
  const inv = useVoxelInventory();
  const selectedRef = useRef(inv.selected);
  selectedRef.current = inv.selected;
  const hotbarRef = useRef(inv.hotbar);
  hotbarRef.current = inv.hotbar;
  const playerRef = useRef({ x: 0, z: 0, yaw: 0 });

  useEffect(() => {
    document.title = `Survive — ${REGIONS[region].label}`;
    setTerrain(null);
    setError(null);
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

  const onMined = useCallback((block: string) => {
    inv.add(block as any, 1);
    playSfx('mine');
    // Side drops so every material is obtainable in-world:
    if (block === 'saxaul' && Math.random() < 0.5) inv.add('ash' as any, 1);
    if (block === 'saxaul' && Math.random() < 0.25) inv.add('fat' as any, 1);
  }, [inv]);

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
  }, [inv]);

  // ESC to close inventory
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && invOpen) setInvOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [invOpen]);

  // Audio: init on first user gesture, start ambient when world is ready
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

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  const cfg = REGIONS[region];

  return (
    <div className="fixed inset-0 bg-[#0c0f14] text-white font-mono">
      <Link
        to="/"
        className="fixed top-3 left-3 z-50 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 border border-white/20 text-[10px] uppercase tracking-widest hover:bg-white/10 transition-colors"
      >
        <ArrowLeft className="w-3 h-3" /> Exit Survive
      </Link>

      {/* Region picker + mute */}
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
        <button
          onClick={toggleMute}
          title={muted ? 'Unmute' : 'Mute'}
          className="px-2 py-1.5 bg-black/60 border border-white/20 hover:bg-white/10 transition-colors"
        >
          {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
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
          <color attach="background" args={[cfg.sky]} />
          <fog attach="fog" args={cfg.fog} />

          <ambientLight intensity={0.55} />
          <directionalLight position={[60, 120, 40]} intensity={1.1} color={'#fff5e0'} />
          <hemisphereLight args={['#c8dbef', '#5a3e22', 0.4]} />

          <Sky distance={450000} sunPosition={[60, 30, 40]} inclination={0.5} azimuth={0.25} />

          <VoxelTerrain world={world} version={version} />
          <Camels world={world} count={12} onMilked={onMilked} />

          <VoxelPlayer
            world={world}
            onWorldMutated={() => setVersion(v => v + 1)}
            onMined={onMined}
            getSelectedBlock={getSelectedBlock}
            consumeSelected={consumeSelected}
            onLockChange={setLocked}
            playerRef={playerRef}
          />
        </Canvas>
      )}

      {world && <VoxelMinimap world={world} playerRef={playerRef} version={version} label={`Map · ${cfg.label}`} />}

      <VoxelHUD locked={locked} onOpenInventory={() => setInvOpen(o => !o)} />
      <VoxelInventoryPanel open={invOpen} onClose={() => setInvOpen(false)} />
    </div>
  );
};

export default VoxelPage;
