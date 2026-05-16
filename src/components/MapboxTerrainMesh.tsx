import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { TerrainData } from '@/lib/geotiff-loader';
import { loadMapboxSatellite } from '@/lib/mapbox-tiles';
import { useVisualMode } from '@/lib/visual-mode';

interface Props {
  terrain: TerrainData;
  exaggeration: number;
  token: string;
  onError?: (msg: string) => void;
}

/**
 * Mapbox satellite imagery draped over the SAME GeoTIFF elevation grid that
 * everything else (lines, pins, basins) uses. This guarantees perfect
 * alignment of overlay features and works for ANY bounds (Khorezm, custom
 * regions, etc.) — we just refetch the satellite texture for the new bbox.
 */
const MapboxTerrainMesh = ({ terrain, exaggeration, token, onError }: Props) => {
  const [satellite, setSatellite] = useState<THREE.Texture | null>(null);
  const [mode] = useVisualMode();
  const isMirage = mode === 'mirage' || mode === 'designer';

  // Refetch satellite whenever bounds change (Khorezm toggle, custom DEM, etc.)
  useEffect(() => {
    if (!token || !terrain.bounds) return;
    let cancelled = false;
    setSatellite(null);
    loadMapboxSatellite(terrain.bounds, token)
      .then((t) => { if (!cancelled) setSatellite(t); })
      .catch((e) => { if (!cancelled) onError?.(e.message); });
    return () => { cancelled = true; };
  }, [token, terrain.bounds, onError]);

  // Build geometry from GeoTIFF — identical formula to TerrainMesh & geoToMeshPos
  const geometry = useMemo(() => {
    const { width: w, height: h, elevations, minElevation, maxElevation, noDataValue } = terrain;
    const elevRange = maxElevation - minElevation || 1;
    const maxHeight = 10 * (exaggeration / 100);
    const positions: number[] = [];
    const uvs: number[] = [];
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let elev = elevations[j * w + i];
        const nd = isNaN(elev) || (noDataValue !== null && elev === noDataValue) || elev <= -9999;
        if (nd) elev = minElevation;
        const normalized = (elev - minElevation) / elevRange;
        const x = (i / (w - 1) - 0.5) * 10;
        const y = (0.5 - j / (h - 1)) * 10 * (h / w);
        const z = normalized * maxHeight;
        positions.push(x, y, z);
        uvs.push(i / (w - 1), 1 - j / (h - 1));
      }
    }
    const indices: number[] = [];
    for (let j = 0; j < h - 1; j++) {
      for (let i = 0; i < w - 1; i++) {
        const a = j * w + i, b = a + 1, c = a + w, d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [terrain, exaggeration]);

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uSatellite: { value: null },
      uMirage: { value: 0 },
      uHasTex: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uSatellite;
      uniform float uMirage;
      uniform float uHasTex;
      varying vec2 vUv;
      void main() {
        vec3 col = uHasTex > 0.5 ? texture2D(uSatellite, vUv).rgb : vec3(0.4, 0.42, 0.45);
        if (uMirage > 0.5) {
          float gray = dot(col, vec3(0.299, 0.587, 0.114));
          // Mild desaturation + slight warm tint — keep land/water colors readable
          vec3 desat = mix(col, vec3(gray), 0.35);
          vec3 warm = desat * vec3(1.05, 1.0, 0.92);
          col = warm;
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  }), []);

  useEffect(() => { material.uniforms.uMirage.value = isMirage ? 1 : 0; }, [isMirage, material]);
  useEffect(() => {
    material.uniforms.uSatellite.value = satellite;
    material.uniforms.uHasTex.value = satellite ? 1 : 0;
    material.needsUpdate = true;
  }, [satellite, material]);

  return <mesh geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} />;
};

export default MapboxTerrainMesh;
