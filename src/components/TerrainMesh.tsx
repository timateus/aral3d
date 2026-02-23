import { useMemo, useState, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import { TerrainData, getElevationColor } from '@/lib/geotiff-loader';

interface TerrainMeshProps {
  terrain: TerrainData;
  exaggeration: number;
  waterLevel: number;
  hideNoData?: boolean;
}

const TerrainMesh = ({ terrain, exaggeration, waterLevel, hideNoData = false }: TerrainMeshProps) => {
  const [hoverInfo, setHoverInfo] = useState<{ position: THREE.Vector3; elevation: number } | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const { geometry, material } = useMemo(() => {
    const { width, height, elevations, minElevation, maxElevation, noDataValue } = terrain;
    const w = width;
    const h = height;

    const elevRange = maxElevation - minElevation || 1;
    const maxHeight = 10 * (exaggeration / 100);

    // Build per-vertex data
    const vertexPositions: number[] = [];
    const vertexColors: number[] = [];
    const vertexUvs: number[] = [];
    const isNoData: boolean[] = [];

    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const srcIdx = j * width + i;
        let elev = elevations[srcIdx];

        const nd = isNaN(elev) || (noDataValue !== null && elev === noDataValue) || elev <= -9999;
        isNoData.push(nd);

        if (nd) elev = minElevation;

        const normalized = (elev - minElevation) / elevRange;
        const x = (i / (w - 1) - 0.5) * 10;
        const y = (0.5 - j / (h - 1)) * 10 * (h / w);
        const z = normalized * maxHeight;

        vertexPositions.push(x, y, z);
        vertexUvs.push(i / (w - 1), 1 - j / (h - 1));

        const isWater = elev <= waterLevel;
        let color: [number, number, number];
        if (isWater) {
          const waterDepth = Math.max(0, Math.min(1, (waterLevel - elev) / (waterLevel - minElevation || 1)));
          color = [
            0.04 + (1 - waterDepth) * 0.12,
            0.12 + (1 - waterDepth) * 0.2,
            0.35 + (1 - waterDepth) * 0.25,
          ];
        } else {
          color = getElevationColor(normalized);
        }
        vertexColors.push(color[0], color[1], color[2]);
      }
    }

    // Build index buffer, skipping faces with no-data vertices if hideNoData
    const indices: number[] = [];
    for (let j = 0; j < h - 1; j++) {
      for (let i = 0; i < w - 1; i++) {
        const a = j * w + i;
        const b = j * w + i + 1;
        const c = (j + 1) * w + i;
        const d = (j + 1) * w + i + 1;

        if (hideNoData && (isNoData[a] || isNoData[b] || isNoData[c])) {
          // skip triangle
        } else {
          indices.push(a, b, c);
        }

        if (hideNoData && (isNoData[b] || isNoData[d] || isNoData[c])) {
          // skip triangle
        } else {
          indices.push(b, d, c);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertexPositions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(vertexUvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: false,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    return { geometry: geo, material: mat };
  }, [terrain, exaggeration, waterLevel, hideNoData]);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const { uv, point } = e;
    if (!uv) return;

    const { width, height, elevations, minElevation, noDataValue } = terrain;
    // UV maps to pixel position — uv.x is left-right, uv.y is bottom-top
    const pixelX = Math.floor(uv.x * (width - 1));
    const pixelY = Math.floor((1 - uv.y) * (height - 1));
    const idx = pixelY * width + pixelX;
    let elev = elevations[idx];

    if ((noDataValue !== null && elev === noDataValue) || isNaN(elev)) {
      elev = minElevation;
    }

    setHoverInfo({ position: point.clone(), elevation: Math.round(elev) });
  }, [terrain]);

  const handlePointerLeave = useCallback(() => {
    setHoverInfo(null);
  }, []);

  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      />
      {hoverInfo && (
        <Html
          position={[hoverInfo.position.x, hoverInfo.position.y + 0.15, hoverInfo.position.z]}
          center
          distanceFactor={8}
          style={{ pointerEvents: 'none' }}
        >
          <div style={{
            color: '#fff',
            background: 'rgba(0,0,0,0.7)',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '10px',
            fontFamily: "'Inter', system-ui, sans-serif",
            whiteSpace: 'nowrap',
          }}>
            {hoverInfo.elevation} m
          </div>
        </Html>
      )}
    </group>
  );
};

export default TerrainMesh;
