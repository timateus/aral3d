import { useMemo } from 'react';
import * as THREE from 'three';
import { TerrainData, getElevationColor } from '@/lib/geotiff-loader';

interface TerrainMeshProps {
  terrain: TerrainData;
  exaggeration: number;
}

const TerrainMesh = ({ terrain, exaggeration }: TerrainMeshProps) => {
  const { geometry, material } = useMemo(() => {
    const { width, height, elevations, minElevation, maxElevation, noDataValue } = terrain;

    // Downsample if very large
    const maxDim = 512;
    const scaleX = width > maxDim ? Math.ceil(width / maxDim) : 1;
    const scaleY = height > maxDim ? Math.ceil(height / maxDim) : 1;
    const w = Math.floor(width / scaleX);
    const h = Math.floor(height / scaleY);

    const geo = new THREE.PlaneGeometry(10, 10 * (h / w), w - 1, h - 1);
    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const elevRange = maxElevation - minElevation || 1;

    // Scale factor for elevation relative to plane size
    const elevScale = (10 / w) * exaggeration * 0.5;

    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const srcIdx = j * scaleY * width + i * scaleX;
        const vertIdx = j * w + i;
        let elev = elevations[srcIdx];

        if ((noDataValue !== null && elev === noDataValue) || isNaN(elev)) {
          elev = minElevation;
        }

        const normalized = (elev - minElevation) / elevRange;
        // Set Z (up) to elevation
        positions.setZ(vertIdx, normalized * elevScale * elevRange);

        const color = getElevationColor(normalized);
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
  }, [terrain, exaggeration]);

  return (
    <mesh geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} />
  );
};

export default TerrainMesh;
