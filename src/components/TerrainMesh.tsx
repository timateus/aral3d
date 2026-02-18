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

    // Data is already downsampled by the loader
    const w = width;
    const h = height;

    const geo = new THREE.PlaneGeometry(10, 10 * (h / w), w - 1, h - 1);
    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const elevRange = maxElevation - minElevation || 1;

    // Normalize so max elevation = exaggeration * (10 / elevRange) to be visible on 10-unit plane
    const maxHeight = 10 * (exaggeration / 100);

    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const srcIdx = j * width + i;
        const vertIdx = j * w + i;
        let elev = elevations[srcIdx];

        if ((noDataValue !== null && elev === noDataValue) || isNaN(elev)) {
          elev = minElevation;
        }

        const normalized = (elev - minElevation) / elevRange;
        // Set Z (up) to elevation
        positions.setZ(vertIdx, normalized * maxHeight);

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
