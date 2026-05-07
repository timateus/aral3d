import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { TerrainData } from '@/lib/geotiff-loader';
import { loadMapboxTextures, MapboxTextures } from '@/lib/mapbox-tiles';
import { useVisualMode } from '@/lib/visual-mode';

interface Props {
  terrain: TerrainData;
  exaggeration: number;
  token: string;
  onError?: (msg: string) => void;
}

const VERTEX_SHADER = /* glsl */ `
  uniform sampler2D uTerrain;
  uniform float uMinElev;
  uniform float uElevRange;
  uniform float uMaxHeight;
  varying vec2 vUv;
  varying float vElevNorm;

  float decodeElev(vec3 c) {
    // Mapbox terrain-RGB encoding (channels are in [0..1])
    return -10000.0 + ((c.r * 255.0) * 65536.0 + (c.g * 255.0) * 256.0 + (c.b * 255.0)) * 0.1;
  }

  void main() {
    vUv = uv;
    vec3 c = texture2D(uTerrain, uv).rgb;
    float elev = decodeElev(c);
    float n = clamp((elev - uMinElev) / uElevRange, 0.0, 1.0);
    vElevNorm = n;
    vec3 displaced = position + vec3(0.0, 0.0, n * uMaxHeight);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uSatellite;
  uniform float uMirage;
  varying vec2 vUv;
  varying float vElevNorm;

  void main() {
    vec3 col = texture2D(uSatellite, vUv).rgb;
    if (uMirage > 0.5) {
      // Desaturate + warm sepia tint for mirage mode
      float gray = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 sepia = vec3(gray * 1.05, gray * 0.97, gray * 0.85);
      col = mix(col, sepia, 0.7);
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

const MapboxTerrainMesh = ({ terrain, exaggeration, token, onError }: Props) => {
  const [textures, setTextures] = useState<MapboxTextures | null>(null);
  const [mode] = useVisualMode();
  const isMirage = mode === 'mirage' || mode === 'designer';

  // Load textures when token or bounds change
  useEffect(() => {
    if (!token || !terrain.bounds) return;
    let cancelled = false;
    setTextures(null);
    loadMapboxTextures(terrain.bounds, token)
      .then((t) => { if (!cancelled) setTextures(t); })
      .catch((e) => { if (!cancelled) onError?.(e.message); });
    return () => { cancelled = true; };
  }, [token, terrain.bounds, onError]);

  // Geometry: high-segment plane in world coords matching the classic mesh
  const geometry = useMemo(() => {
    const w = terrain.width, h = terrain.height;
    const meshW = 10;
    const meshH = 10 * (h / w);
    const geo = new THREE.PlaneGeometry(meshW, meshH, 256, 256);
    return geo;
  }, [terrain.width, terrain.height]);

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uSatellite: { value: null },
        uTerrain: { value: null },
        uMinElev: { value: 0 },
        uElevRange: { value: 1 },
        uMaxHeight: { value: 10 * (exaggeration / 100) },
        uMirage: { value: isMirage ? 1.0 : 0.0 },
      },
      side: THREE.DoubleSide,
    });
    return mat;
  }, []);

  // Update uniforms when inputs change
  useEffect(() => {
    material.uniforms.uMaxHeight.value = 10 * (exaggeration / 100);
  }, [exaggeration, material]);

  useEffect(() => {
    material.uniforms.uMirage.value = isMirage ? 1.0 : 0.0;
  }, [isMirage, material]);

  useEffect(() => {
    if (!textures) return;
    material.uniforms.uSatellite.value = textures.satellite;
    material.uniforms.uTerrain.value = textures.terrainRGB;
    material.uniforms.uMinElev.value = textures.minElev;
    material.uniforms.uElevRange.value = (textures.maxElev - textures.minElev) || 1;
    material.needsUpdate = true;
  }, [textures, material]);

  if (!textures) return null;

  return (
    <mesh geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} />
  );
};

export default MapboxTerrainMesh;
