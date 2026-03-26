import { useMemo } from 'react';
import * as THREE from 'three';
import type { TerrainData } from '@/lib/geotiff-loader';
import type { SandboxSimState } from '@/lib/sandbox-simulation';

interface SandboxOverlayProps {
  terrain: TerrainData;
  exaggeration: number;
  simState: SandboxSimState;
  renderKey: number;
}

export default function SandboxOverlay({ terrain, exaggeration, simState, renderKey }: SandboxOverlayProps) {
  const geometry = useMemo(() => {
    if (!simState) return null;

    const { width, height } = terrain;
    const { waterDepth, irrigationDepth, saltDepth, dustDensity, reedsDensity, effectiveElev } = simState;
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const maxHeight = 10 * (exaggeration / 100);

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const vertexMap = new Map<number, number>();

    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        const idx = j * width + i;
        const w = waterDepth[idx];
        const ir = irrigationDepth[idx];
        const s = saltDepth[idx];
        const d = dustDensity[idx];
        const re = reedsDensity[idx];

        if (w < 0.01 && ir < 0.01 && s < 0.01 && d < 0.1 && re < 0.01) continue;

        let r = 0, g = 0, b = 0, totalWeight = 0;

        // River water — deep blue
        if (w > 0.01) {
          const weight = Math.min(w, 5);
          r += 0.07 * weight; g += 0.40 * weight; b += 0.85 * weight;
          totalWeight += weight;
        }
        // Irrigation — amber/gold
        if (ir > 0.01) {
          const weight = Math.min(ir, 5);
          r += 0.83 * weight; g += 0.63 * weight; b += 0.09 * weight;
          totalWeight += weight;
        }
        // Salt — pale white/cream
        if (s > 0.01) {
          const weight = Math.min(s, 5);
          r += 0.91 * weight; g += 0.88 * weight; b += 0.82 * weight;
          totalWeight += weight;
        }
        // Dust — hazy brown
        if (d > 0.1) {
          const weight = Math.min(d / 15, 4);
          r += 0.78 * weight; g += 0.66 * weight; b += 0.49 * weight;
          totalWeight += weight;
        }
        // Reeds — deep green
        if (re > 0.01) {
          const weight = Math.min(re, 5);
          r += 0.18 * weight; g += 0.60 * weight; b += 0.22 * weight;
          totalWeight += weight;
        }

        if (totalWeight > 0) {
          r /= totalWeight; g /= totalWeight; b /= totalWeight;
        }

        const elev = effectiveElev[idx];
        const stackHeight = s + Math.max(w, ir) + re * 0.3;
        const normalized = (elev + stackHeight - terrain.minElevation) / elevRange;

        const x = (i / (width - 1) - 0.5) * 10;
        const y = (0.5 - j / (height - 1)) * 10 * (height / width);
        const z = normalized * maxHeight + 0.05;

        const vIdx = positions.length / 3;
        vertexMap.set(idx, vIdx);
        positions.push(x, y, z);
        colors.push(r, g, b);
      }
    }

    if (positions.length === 0) return null;

    for (let j = 0; j < height - 1; j++) {
      for (let i = 0; i < width - 1; i++) {
        const a = vertexMap.get(j * width + i);
        const b2 = vertexMap.get(j * width + i + 1);
        const c = vertexMap.get((j + 1) * width + i);
        const dd = vertexMap.get((j + 1) * width + i + 1);

        if (a !== undefined && b2 !== undefined && c !== undefined) {
          indices.push(a, b2, c);
        }
        if (b2 !== undefined && dd !== undefined && c !== undefined) {
          indices.push(b2, dd, c);
        }
      }
    }

    if (indices.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrain, exaggeration, simState, renderKey]);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      roughness: 0.6,
      metalness: 0.1,
    });
  }, []);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} />
  );
}
