import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { VoxelWorld } from '@/lib/voxel/voxel-world';
import { BLOCKS } from '@/lib/voxel/block-types';

interface Props {
  world: VoxelWorld;
  playerRef: React.MutableRefObject<{ x: number; z: number; yaw: number }>;
  size?: number;
  version?: number;
  label?: string;
}

const VoxelMinimap = ({ world, playerRef, size = 200, version = 0, label = 'Map' }: Props) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Pre-render world top-down to an offscreen canvas
  const base = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = world.width;
    c.height = world.depth;
    const ctx = c.getContext('2d');
    if (!ctx) return c;
    const img = ctx.createImageData(world.width, world.depth);
    for (let j = 0; j < world.depth; j++) {
      for (let i = 0; i < world.width; i++) {
        const idx = j * world.width + i;
        const h = world.heights[idx];
        let blockId = 'sand';
        if (h > 0) {
          const cell = world.cells[idx * world.maxStackHeight + h - 1];
          blockId = world.palette[cell] ?? 'sand';
        }
        const hex = (BLOCKS as any)[blockId]?.color ?? '#222';
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
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
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const halfW = world.width / 2;
    const halfD = world.depth / 2;
    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(base, 0, 0, size, size);
      const { x, z, yaw } = playerRef.current;
      const px = ((x + halfW) / world.width) * size;
      const py = ((z + halfD) / world.depth) * size;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(yaw);
      ctx.fillStyle = '#ff3b3b';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(6, 6);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [base, size, world, playerRef]);

  if (!mounted) return null;

  const node = (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.7)',
        border: '1px solid rgba(255,255,255,0.25)',
        padding: 6,
        width: size + 12,
        pointerEvents: 'none',
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      <div style={{
        fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.6)', display: 'flex', justifyContent: 'space-between',
        padding: '0 2px 4px',
      }}>
        <span>{label}</span>
        <span style={{ color: 'rgba(255,255,255,0.4)' }}>{world.width}×{world.depth}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ display: 'block', imageRendering: 'pixelated', background: '#111' }}
      />
    </div>
  );

  return createPortal(node, document.body);
};

export default VoxelMinimap;
