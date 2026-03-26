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
    const { waterDepth, sandDepth, fireIntensity, plantDensity, lavaDepth, effectiveElev } = simState;
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const maxHeight = 10 * (exaggeration / 100);

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    // Build vertices for active pixels
    const vertexMap = new Map<number, number>(); // pixel index -> vertex index

    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        const idx = j * width + i;
        const w = waterDepth[idx];
        const s = sandDepth[idx];
        const f = fireIntensity[idx];
        const p = plantDensity[idx];
        const l = lavaDepth[idx];

        if (w < 0.01 && s < 0.01 && f <= 0 && p < 0.01 && l < 0.01) continue;

        // Determine dominant element for color
        let r = 0, g = 0, b = 0, totalWeight = 0;

        if (w > 0.01) {
          const weight = Math.min(w, 5);
          r += 0.12 * weight;
          g += 0.56 * weight;
          b += 1.0 * weight;
          totalWeight += weight;
        }
        if (s > 0.01) {
          const weight = Math.min(s, 5);
          r += 0.82 * weight;
          g += 0.71 * weight;
          b += 0.55 * weight;
          totalWeight += weight;
        }
        if (f > 0) {
          const weight = f / 20;
          r += 1.0 * weight;
          g += 0.27 * weight;
          b += 0.0 * weight;
          totalWeight += weight;
        }
        if (p > 0.01) {
          const weight = Math.min(p, 5);
          r += 0.13 * weight;
          g += 0.77 * weight;
          b += 0.37 * weight;
          totalWeight += weight;
        }
        if (l > 0.01) {
          const weight = Math.min(l, 5);
          r += 1.0 * weight;
          g += 0.4 * weight;
          b += 0.0 * weight;
          totalWeight += weight;
        }

        if (totalWeight > 0) {
          r /= totalWeight;
          g /= totalWeight;
          b /= totalWeight;
        }

        // Position: slightly above terrain (or on top of accumulated material)
        const elev = effectiveElev[idx];
        const topDepth = Math.max(w, l);
        const normalized = (elev + topDepth - terrain.minElevation) / elevRange;

        const x = (i / (width - 1) - 0.5) * 10;
        const z = -(0.5 - j / (height - 1)) * 10 * (height / width);
        const y = normalized * maxHeight + 0.02;

        const vIdx = positions.length / 3;
        vertexMap.set(idx, vIdx);
        positions.push(x, y, z);
        colors.push(r, g, b);
      }
    }

    if (positions.length === 0) return null;

    // Build triangles between adjacent active pixels
    for (let j = 0; j < height - 1; j++) {
      for (let i = 0; i < width - 1; i++) {
        const a = vertexMap.get(j * width + i);
        const b2 = vertexMap.get(j * width + i + 1);
        const c = vertexMap.get((j + 1) * width + i);
        const d = vertexMap.get((j + 1) * width + i + 1);

        if (a !== undefined && b2 !== undefined && c !== undefined) {
          indices.push(a, b2, c);
        }
        if (b2 !== undefined && d !== undefined && c !== undefined) {
          indices.push(b2, d, c);
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
