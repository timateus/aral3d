import { useEffect, useMemo, useRef } from 'react';
import type { VoxelWorld } from '@/lib/voxel/voxel-world';
import { BLOCKS } from '@/lib/voxel/block-types';

interface Props {
  world: VoxelWorld;
  /** Ref updated each frame by VoxelPlayer: { x, z, yaw } in world units / radians */
  playerRef: React.MutableRefObject<{ x: number; z: number; yaw: number }>;
  size?: number;
  version?: number; // bump to re-render base when world mutates
}

const VoxelMinimap = ({ world, playerRef, size = 180, version = 0 }: Props) => {
  // Pre-render world top-down to an offscreen canvas
  const base = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = world.width;
    c.height = world.depth;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(world.width, world.depth);
    for (let j = 0; j < world.depth; j++) {
      for (let i = 0; i < world.width; i++) {
        const idx = j * world.width + i;
        const h = world.heights[idx];
        let block: keyof typeof BLOCKS = 'sand';
        if (h > 0) block = world.palette[world.cells[idx * world.maxStackHeight + h - 1]] as any;
        const hex = BLOCKS[block]?.color ?? '#000';
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        // Light shading by height for relief
        const shade = 0.55 + 0.45 * Math.min(1, h / Math.max(1, world.maxStackHeight * 0.6));
        const p = (j * world.width + i) * 4;
        img.data[p] = Math.round(r * shade);
        img.data[p + 1] = Math.round(g * shade);
        img.data[p + 2] = Math.round(b * shade);
        img.data[p + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, version]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const halfW = world.width / 2;
    const halfD = world.depth / 2;
    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(base, 0, 0, size, size);
      // Player marker
      const { x, z, yaw } = playerRef.current;
      const px = ((x + halfW) / world.width) * size;
      const py = ((z + halfD) / world.depth) * size;
      // Heading triangle
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(yaw);
      ctx.fillStyle = '#ff3b3b';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 5);
      ctx.lineTo(-5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [base, size, world, playerRef]);

  return (
    <div
      className="fixed top-3 right-3 z-40 bg-black/60 border border-white/20 p-1.5"
      style={{ width: size + 12 }}
    >
      <div className="text-[9px] uppercase tracking-widest text-white/60 mb-1 px-0.5 flex justify-between">
        <span>Map · Khorezm</span>
        <span className="text-white/40">{world.width}×{world.depth}</span>
      </div>
      <canvas ref={canvasRef} width={size} height={size} className="block" style={{ imageRendering: 'pixelated' }} />
    </div>
  );
};

export default VoxelMinimap;
