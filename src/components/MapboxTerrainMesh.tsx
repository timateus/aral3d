import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { TerrainData } from '@/lib/geotiff-loader';
import { loadBaseStyleTexture, type BaseStyle } from '@/lib/mapbox-tiles';
import { useVisualMode } from '@/lib/visual-mode';
import { useTerrainMode } from '@/hooks/useTerrainMode';

interface Props {
  terrain: TerrainData;
  exaggeration: number;
  token: string;
  onError?: (msg: string) => void;
  baseStyleOverride?: BaseStyle;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  gamma?: number;
  /** Render terrain as wireframe overlay only (no satellite). */
  wireframe?: boolean;
}

const MapboxTerrainMesh = ({
  terrain, exaggeration, token, onError, baseStyleOverride,
  brightness = 1, contrast = 1, saturation = 1, gamma = 1, wireframe = false,
}: Props) => {
  const [satellite, setSatellite] = useState<THREE.Texture | null>(null);
  const [mode] = useVisualMode();
  const isMirage = mode === 'mirage' || mode === 'designer';
  const { baseStyle: globalBaseStyle } = useTerrainMode();
  const baseStyle = baseStyleOverride ?? globalBaseStyle;

  useEffect(() => {
    if (!terrain.bounds) return;
    if (baseStyle !== 'osm' && baseStyle !== 'satlas' && !token) return;
    let cancelled = false;
    setSatellite(null);
    loadBaseStyleTexture(terrain.bounds, baseStyle, token)
      .then((t) => { if (!cancelled) setSatellite(t); })
      .catch((e) => { if (!cancelled) onError?.(e.message); });
    return () => { cancelled = true; };
  }, [token, terrain.bounds, onError, baseStyle]);

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
      uBrightness: { value: brightness },
      uContrast: { value: contrast },
      uSaturation: { value: saturation },
      uGamma: { value: gamma },
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
      uniform float uBrightness;
      uniform float uContrast;
      uniform float uSaturation;
      uniform float uGamma;
      varying vec2 vUv;
      void main() {
        vec3 col = uHasTex > 0.5 ? texture2D(uSatellite, vUv).rgb : vec3(0.55, 0.57, 0.6);
        // brightness
        col *= uBrightness;
        // contrast around 0.5
        col = (col - 0.5) * uContrast + 0.5;
        // saturation
        float gray = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(gray), col, uSaturation);
        // gamma
        col = pow(max(col, 0.0), vec3(1.0 / max(uGamma, 0.0001)));
        col = clamp(col, 0.0, 1.0);
        if (uMirage > 0.5) {
          float g = dot(col, vec3(0.299, 0.587, 0.114));
          vec3 desat = mix(col, vec3(g), 0.35);
          col = desat * vec3(1.05, 1.0, 0.92);
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  }), []);

  useEffect(() => { material.uniforms.uMirage.value = isMirage ? 1 : 0; }, [isMirage, material]);
  useEffect(() => { material.uniforms.uBrightness.value = brightness; }, [brightness, material]);
  useEffect(() => { material.uniforms.uContrast.value = contrast; }, [contrast, material]);
  useEffect(() => { material.uniforms.uSaturation.value = saturation; }, [saturation, material]);
  useEffect(() => { material.uniforms.uGamma.value = gamma; }, [gamma, material]);
  useEffect(() => {
    material.uniforms.uSatellite.value = satellite;
    material.uniforms.uHasTex.value = satellite ? 1 : 0;
    material.needsUpdate = true;
  }, [satellite, material]);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={geometry} material={material} userData={{ terrainSurface: true }} />
      {wireframe && (
        <mesh geometry={geometry}>
          <meshBasicMaterial color="#111827" wireframe transparent opacity={0.55} depthTest={false} />
        </mesh>
      )}
    </group>
  );
};

export default MapboxTerrainMesh;
