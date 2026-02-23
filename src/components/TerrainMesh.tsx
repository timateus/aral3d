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

const TerrainMesh = ({ terrain, exaggeration, waterLevel }: TerrainMeshProps) => {
  const [hoverInfo, setHoverInfo] = useState<{ position: THREE.Vector3; elevation: number } | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const { geometry, material } = useMemo(() => {
    const { width, height, elevations, minElevation, maxElevation, noDataValue } = terrain;
    const w = width;
    const h = height;

    const geo = new THREE.PlaneGeometry(10, 10 * (h / w), w - 1, h - 1);
    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const elevRange = maxElevation - minElevation || 1;
    const maxHeight = 10 * (exaggeration / 100);

    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const srcIdx = j * width + i;
        const vertIdx = j * w + i;
        let elev = elevations[srcIdx];

        if ((noDataValue !== null && elev === noDataValue) || isNaN(elev) || elev <= -9999) {
          elev = minElevation;
        }

        const normalized = (elev - minElevation) / elevRange;
        positions.setZ(vertIdx, normalized * maxHeight);

        const isWater = elev <= waterLevel;
        let color: [number, number, number];
        if (isWater) {
          // Deeper water = darker blue
          const waterDepth = Math.max(0, Math.min(1, (waterLevel - elev) / (waterLevel - minElevation || 1)));
          color = [
            0.04 + (1 - waterDepth) * 0.12,
            0.12 + (1 - waterDepth) * 0.2,
            0.35 + (1 - waterDepth) * 0.25,
          ];
        } else {
          color = getElevationColor(normalized);
        }
        colors[vertIdx * 3] = color[0];
        colors[vertIdx * 3 + 1] = color[1];
        colors[vertIdx * 3 + 2] = color[2];
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: false,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    return { geometry: geo, material: mat };
  }, [terrain, exaggeration, waterLevel]);

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
