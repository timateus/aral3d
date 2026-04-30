import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { TerrainData } from '@/lib/geotiff-loader';
import type { DustState } from '@/lib/dust-simulation';
import { DUST_STRIDE } from '@/lib/dust-simulation';

interface DustOverlayProps {
  terrain: TerrainData;
  exaggeration: number;
  state: DustState | null;
  renderKey: number;
}

/**
 * Renders dust particles as additive sprites in the same rotated frame the
 * other overlays use (-PI/2 around X). World coords from sim are
 * (x, planarY, elevation); after the group rotation those become
 * (x, elevation*scale, -planarY) in scene space.
 */
export default function DustOverlay({ terrain, exaggeration, state, renderKey }: DustOverlayProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const geomRef = useRef<THREE.BufferGeometry>(null);

  // Texture: small soft circle for each dust grain
  const texture = useMemo(() => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(220,180,120,0.9)');
    grad.addColorStop(0.4, 'rgba(190,150,100,0.4)');
    grad.addColorStop(1, 'rgba(160,120,80,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  const capacity = state?.capacity ?? 0;

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity * 3), 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(capacity), 1));
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(capacity), 1));
    g.setDrawRange(0, capacity);
    return g;
  }, [capacity]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: { uTex: { value: texture } },
      vertexShader: `
        attribute float alpha;
        attribute float size;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (320.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTex;
        varying float vAlpha;
        void main() {
          vec4 t = texture2D(uTex, gl_PointCoord);
          gl_FragColor = vec4(t.rgb, t.a * vAlpha);
          if (gl_FragColor.a < 0.01) discard;
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
  }, [texture]);

  // Push sim data into geometry every frame the parent bumps renderKey
  useEffect(() => {
    if (!state || !geometry) return;
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const heightScale = 10 * (exaggeration / 100);
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const alphaAttr = geometry.getAttribute('alpha') as THREE.BufferAttribute;
    const sizeAttr = geometry.getAttribute('size') as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;
    const alpha = alphaAttr.array as Float32Array;
    const size = sizeAttr.array as Float32Array;

    let written = 0;
    for (let i = 0; i < state.capacity; i++) {
      if (!state.alive[i]) continue;
      const b = i * DUST_STRIDE;
      const x = state.data[b + 0];
      const y = state.data[b + 1];
      const elev = state.data[b + 2];
      // Translate elevation to world-Z exactly like SandboxOverlay
      const z = ((elev - terrain.minElevation) / elevRange) * heightScale + 0.05;
      pos[written * 3 + 0] = x;
      pos[written * 3 + 1] = y;
      pos[written * 3 + 2] = z;
      const age = state.data[b + 6];
      const life = state.data[b + 7];
      const t = age / life;
      // Fade in then out
      const fadeIn = Math.min(1, t / 0.1);
      const fadeOut = 1 - Math.max(0, (t - 0.4) / 0.6);
      alpha[written] = Math.max(0, fadeIn * fadeOut) * 0.55;
      size[written] = 0.18 + t * 0.55; // grow as it lofts
      written++;
    }
    // Zero out unused slots so they don't render at origin
    for (let k = written; k < state.capacity; k++) {
      pos[k * 3 + 0] = 0;
      pos[k * 3 + 1] = 0;
      pos[k * 3 + 2] = -9999;
      alpha[k] = 0;
      size[k] = 0;
    }
    posAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    geometry.setDrawRange(0, written);
  }, [state, renderKey, geometry, terrain, exaggeration]);

  if (!state) return null;

  return (
    // Same rotation as SandboxOverlay/TerrainMesh wrappers
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      frustumCulled={false}
    />
  );
}
