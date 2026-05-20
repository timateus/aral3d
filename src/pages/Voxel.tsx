import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { loadGeoTiff, type TerrainData } from '@/lib/geotiff-loader';
import { buildVoxelWorld, type VoxelWorld } from '@/lib/voxel/voxel-world';
import { useVoxelInventory } from '@/hooks/useVoxelInventory';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import VoxelTerrain from '@/components/voxel/VoxelTerrain';
import VoxelPlayer from '@/components/voxel/VoxelPlayer';
import VoxelHUD from '@/components/voxel/VoxelHUD';
import VoxelInventoryPanel from '@/components/voxel/VoxelInventoryPanel';
import Camels from '@/components/voxel/Camels';
import VoxelMinimap from '@/components/voxel/VoxelMinimap';

const VoxelPage = () => {
  const [terrain, setTerrain] = useState<TerrainData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [locked, setLocked] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const inv = useVoxelInventory();
  const selectedRef = useRef(inv.selected);
  selectedRef.current = inv.selected;
  const hotbarRef = useRef(inv.hotbar);
  hotbarRef.current = inv.hotbar;

  useEffect(() => {
    document.title = 'Survive — Aral3D Voxel Mode';
    loadGeoTiff('/data/khorezm.tif')
      .then(setTerrain)
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  const world: VoxelWorld | null = useMemo(() => {
    if (!terrain) return null;
    return buildVoxelWorld(terrain, {
      targetWidth: 160,
      targetDepth: 160,
      blockHeightMeters: 4,
      verticalExaggeration: 2.5,
      waterLevelMeters: 53,
    });
  }, [terrain]);

  const onMined = useCallback((block: string) => {
    inv.add(block as any, 1);
  }, [inv]);

  const getSelectedBlock = useCallback(() => {
    const slot = hotbarRef.current[selectedRef.current];
    return slot?.block ?? null;
  }, []);

  const consumeSelected = useCallback(() => inv.useSelected(), [inv]);

  const onMilked = useCallback(() => {
    inv.add('milk' as any, 1);
    toast.success('Camel milked → 1× Milk');
  }, [inv]);

  // ESC to close inventory
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && invOpen) setInvOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [invOpen]);

  return (
    <div className="fixed inset-0 bg-[#0c0f14] text-white font-mono">
      <Link
        to="/"
        className="fixed top-3 left-3 z-50 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 border border-white/20 text-[10px] uppercase tracking-widest hover:bg-white/10 transition-colors"
      >
        <ArrowLeft className="w-3 h-3" /> Exit Survive
      </Link>

      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-3 py-1 bg-black/60 border border-white/20 text-[10px] uppercase tracking-widest text-white/70">
        Survive — Khorezm Voxel
      </div>

      {!world && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
          <Loader2 className="w-6 h-6 animate-spin" />
          <div className="text-[10px] uppercase tracking-widest">Generating voxel world…</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm">
          Failed to load terrain: {error}
        </div>
      )}

      {world && (
        <Canvas
          shadows={false}
          dpr={[1, 1.5]}
          camera={{ fov: 75, near: 0.1, far: 600 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <color attach="background" args={['#aac3d6']} />
          <fog attach="fog" args={['#aac3d6', 80, 260]} />

          {/* Lighting */}
          <ambientLight intensity={0.55} />
          <directionalLight
            position={[60, 120, 40]}
            intensity={1.1}
            color={'#fff5e0'}
          />
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
          />
        </Canvas>
      )}

      <VoxelHUD locked={locked} onOpenInventory={() => setInvOpen(o => !o)} />
      <VoxelInventoryPanel open={invOpen} onClose={() => setInvOpen(false)} />
    </div>
  );
};

export default VoxelPage;
