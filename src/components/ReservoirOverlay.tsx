import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { TerrainData } from '@/lib/geotiff-loader';
import type { ReservoirResult } from '@/lib/dam-simulation';
import { Droplets } from 'lucide-react';

interface ReservoirOverlayProps {
  terrain: TerrainData;
  exaggeration: number;
  reservoir: ReservoirResult;
}

const ReservoirOverlay = ({ terrain, exaggeration, reservoir }: ReservoirOverlayProps) => {
  const { width, height, elevations, minElevation, maxElevation } = terrain;
  const elevRange = maxElevation - minElevation || 1;
  const maxHeight = 10 * (exaggeration / 100);

  // Build a mesh of only the flooded pixels as a water surface
  const geometry = useMemo(() => {
    const { floodedPixels, crestElevation } = reservoir;
    if (floodedPixels.size === 0) return null;

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const vertexMap = new Map<number, number>();

    let vertIdx = 0;

    // Create vertices for all flooded pixels
    for (const idx of floodedPixels) {
      const row = Math.floor(idx / width);
      const col = idx % width;

      const x = (col / (width - 1) - 0.5) * 10;
      const y = (0.5 - row / (height - 1)) * 10 * (height / width);
      // Water surface at crest elevation
      const normalizedCrest = (crestElevation - minElevation) / elevRange;
      const z = normalizedCrest * maxHeight + 0.01; // tiny offset above terrain

      positions.push(x, y, z);

      // Color based on depth
      const elev = elevations[idx];
      const depth = crestElevation - elev;
      const maxD = reservoir.maxDepth || 1;
      const t = Math.min(1, depth / maxD);

      // Deep blue for deep, lighter cyan for shallow
      colors.push(
        0.1 + (1 - t) * 0.2,
        0.3 + (1 - t) * 0.4,
        0.7 + (1 - t) * 0.2
      );

      vertexMap.set(idx, vertIdx);
      vertIdx++;
    }

    // Build triangles between adjacent flooded pixels
    for (const idx of floodedPixels) {
      const row = Math.floor(idx / width);
      const col = idx % width;
      const right = idx + 1;
      const below = idx + width;
      const belowRight = idx + width + 1;

      // Triangle 1: current, right, below
      if (col < width - 1 && row < height - 1) {
        if (floodedPixels.has(right) && floodedPixels.has(below)) {
          indices.push(vertexMap.get(idx)!, vertexMap.get(right)!, vertexMap.get(below)!);
        }
        // Triangle 2: right, below-right, below
        if (floodedPixels.has(right) && floodedPixels.has(belowRight) && floodedPixels.has(below)) {
          indices.push(vertexMap.get(right)!, vertexMap.get(belowRight)!, vertexMap.get(below)!);
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
  }, [reservoir, terrain, exaggeration, width, height, elevations, minElevation, elevRange, maxHeight]);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      roughness: 0.2,
      metalness: 0.1,
    });
  }, []);

  if (!geometry) return null;

  return (
    <group>
      <mesh geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} />
    </group>
  );
};

export default ReservoirOverlay;
