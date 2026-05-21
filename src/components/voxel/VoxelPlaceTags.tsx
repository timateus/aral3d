import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { VoxelWorld } from '@/lib/voxel/voxel-world';

// A "zone" is defined in normalized map coords (u, v in [0,1]) where (0,0) is NW.
// We pick the zone whose center is closest to the player and trigger when it changes.
interface Zone {
  id: string;
  u: number; v: number; // center
  title: string;
  blurb: string;
}

const ZONES: Record<'khorezm' | 'aral', Zone[]> = {
  aral: [
    { id: 'moynaq',   u: 0.30, v: 0.35, title: '🚢 Moynaq Ship Graveyard',
      blurb: 'Rusting trawlers sit on sand. Until the 1980s, this was a busy fishing port.' },
    { id: 'aralkum',  u: 0.55, v: 0.55, title: '🏜️ Aralkum Desert',
      blurb: 'The youngest desert on Earth — born in the 1960s as the sea retreated.' },
    { id: 'vozrozh',  u: 0.65, v: 0.30, title: '☣️ Vozrozhdeniya Island',
      blurb: 'A former Soviet bio-weapons test island. Now a peninsula since 2002.' },
    { id: 'north',    u: 0.45, v: 0.10, title: '💧 North Aral Remnant',
      blurb: 'Kazakhstan’s Kok-Aral dam (2005) is slowly bringing fish back here.' },
    { id: 'delta',    u: 0.20, v: 0.65, title: '🌾 Amu Darya Delta',
      blurb: 'Once a vast wetland with tigers and pelicans. Now mostly cotton and dust.' },
    { id: 'saltflat', u: 0.80, v: 0.75, title: '🧂 Salt Flats',
      blurb: 'You are standing on dried seabed. In 1960 there were 30 m of water above your head.' },
    { id: 'oldshore', u: 0.15, v: 0.20, title: '📜 1960 Shoreline',
      blurb: 'Right here, the old Aral coast lapped quietly. Bring a snorkel.' },
  ],
  khorezm: [
    { id: 'khiva',    u: 0.30, v: 0.40, title: '🕌 Old Khiva',
      blurb: 'A 2,500-year-old walled city of turquoise minarets and slave-market legends.' },
    { id: 'amu',      u: 0.55, v: 0.50, title: '🌊 Amu Darya Bend',
      blurb: 'Alexander the Great crossed this river in 329 BC. It’s thinner now.' },
    { id: 'cotton',   u: 0.40, v: 0.70, title: '☁️ Cotton Country',
      blurb: '"White gold". Each shirt you own took ~2,700 L of Amu Darya water.' },
    { id: 'kyzylkum', u: 0.80, v: 0.30, title: '🐪 Kyzylkum Edge',
      blurb: 'The "Red Sands" begin here. Camels outnumber humans 3 to 1.' },
    { id: 'karakum',  u: 0.20, v: 0.20, title: '🦂 Karakum Fringe',
      blurb: '"Black sand" desert. Scorpions hunt at night — keep your boots zipped.' },
    { id: 'ruins',    u: 0.70, v: 0.75, title: '🏛️ Ancient Khwarezm Ruins',
      blurb: 'Mud-brick fortresses (qalas) from the Zoroastrian era still stand half-buried.' },
    { id: 'oasis',    u: 0.50, v: 0.30, title: '🌳 Green Oasis',
      blurb: 'Mulberry trees, melons, and silk worms. The oasis has fed people for 3,000 years.' },
  ],
};

interface Props {
  world: VoxelWorld;
  playerRef: React.MutableRefObject<{ x: number; z: number; yaw: number }>;
  region: 'khorezm' | 'aral';
}

const VoxelPlaceTags = ({ world, playerRef, region }: Props) => {
  const currentRef = useRef<string | null>(null);
  const [current, setCurrent] = useState<Zone | null>(null);

  // Reset memory when region changes
  useEffect(() => {
    currentRef.current = null;
    setCurrent(null);
  }, [region]);

  useEffect(() => {
    const zones = ZONES[region];
    const id = setInterval(() => {
      const halfW = world.width / 2, halfD = world.depth / 2;
      const u = (playerRef.current.x + halfW) / world.width;
      const v = (playerRef.current.z + halfD) / world.depth;
      let best: Zone | null = null;
      let bestD = Infinity;
      for (const z of zones) {
        const du = z.u - u, dv = z.v - v;
        const d = du * du + dv * dv;
        if (d < bestD) { bestD = d; best = z; }
      }
      // Only fire when zone radius < ~0.18 (so far edges don't trigger)
      if (best && bestD < 0.035 && best.id !== currentRef.current) {
        currentRef.current = best.id;
        setCurrent(best);
        toast(best.title, { description: best.blurb, duration: 5000 });
      }
    }, 800);
    return () => clearInterval(id);
  }, [world, playerRef, region]);

  if (!current) return null;
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-40 pointer-events-none"
      style={{ bottom: 84 }}
    >
      <div className="bg-black/70 border border-white/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-white/80">
        <span className="text-white/50 mr-2">You are in</span>
        <span className="text-white">{current.title}</span>
      </div>
    </div>
  );
};

export default VoxelPlaceTags;
