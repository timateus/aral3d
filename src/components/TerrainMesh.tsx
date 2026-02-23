import { useMemo, useState, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import { TerrainData, GeoBounds, getElevationColor } from '@/lib/geotiff-loader';

interface TerrainMeshProps {
  terrain: TerrainData;
  exaggeration: number;
  waterLevel: number;
  hideNoData?: boolean;
  waterBounds?: GeoBounds | null;
}

const TerrainMesh = ({ terrain, exaggeration, waterLevel, hideNoData = false, waterBounds }: TerrainMeshProps) => {
  const [hoverInfo, setHoverInfo] = useState<{ position: THREE.Vector3; elevation: number } | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  // Geometry only depends on terrain shape + exaggeration (NOT waterLevel)
  const { geometry, vertexMeta } = useMemo(() => {
    const { width, height, elevations, minElevation, maxElevation, noDataValue } = terrain;
    const w = width;
    const h = height;

    const elevRange = maxElevation - minElevation || 1;
    const maxHeight = 10 * (exaggeration / 100);

    const vertexPositions: number[] = [];
    const vertexUvs: number[] = [];
    const isNoData: boolean[] = [];
    const normalizedElevs: number[] = [];
    const rawElevs: number[] = [];

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
        normalizedElevs.push(normalized);
        rawElevs.push(elev);
      }
    }

    // Build index buffer
    const indices: number[] = [];
    for (let j = 0; j < h - 1; j++) {
      for (let i = 0; i < w - 1; i++) {
        const a = j * w + i;
        const b = j * w + i + 1;
        const c = (j + 1) * w + i;
        const d = (j + 1) * w + i + 1;

        if (!(hideNoData && (isNoData[a] || isNoData[b] || isNoData[c]))) {
          indices.push(a, b, c);
        }
        if (!(hideNoData && (isNoData[b] || isNoData[d] || isNoData[c]))) {
          indices.push(b, d, c);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertexPositions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(vertexUvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return {
      geometry: geo,
      vertexMeta: { isNoData, normalizedElevs, rawElevs, width: w, height: h },
    };
  }, [terrain, exaggeration, hideNoData]);

  // Colors depend on waterLevel but NOT geometry shape — much cheaper to recompute
  useMemo(() => {
    const { normalizedElevs, rawElevs, width: w, height: h } = vertexMeta;
    const { minElevation, bounds } = terrain;
    const totalVerts = w * h;
    const colors = new Float32Array(totalVerts * 3);

    // Determine water-eligible region
    const wb = waterBounds ?? bounds;

    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const idx = j * w + i;
        const elev = rawElevs[idx];
        const normalized = normalizedElevs[idx];

        // Check if this pixel is within the water bounds
        let inWaterRegion = true;
        if (wb && bounds) {
          const lon = bounds.minLon + (i / (w - 1)) * (bounds.maxLon - bounds.minLon);
          const lat = bounds.maxLat - (j / (h - 1)) * (bounds.maxLat - bounds.minLat);
          inWaterRegion = lon >= wb.minLon && lon <= wb.maxLon && lat >= wb.minLat && lat <= wb.maxLat;
        }

        const isWater = inWaterRegion && elev <= waterLevel;
        let color: [number, number, number];
        if (isWater) {
          const waterDepth = Math.max(0, Math.min(1, (waterLevel - elev) / (waterLevel - minElevation || 1)));
          color = [
            0.04 + (1 - waterDepth) * 0.12,
            0.12 + (1 - waterDepth) * 0.2,
            0.35 + (1 - waterDepth) * 0.25,
          ];
        } else {
          color = getElevationColor(normalized, elev);
        }
        colors[idx * 3] = color[0];
        colors[idx * 3 + 1] = color[1];
        colors[idx * 3 + 2] = color[2];
      }
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.attributes.color.needsUpdate = true;
  }, [geometry, vertexMeta, waterLevel, waterBounds, terrain]);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: false,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
  }, []);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const { uv, point } = e;
    if (!uv) return;

    const { width, height, elevations, minElevation, noDataValue } = terrain;
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
