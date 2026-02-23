import { useRef, useEffect, useState, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';

interface RiverFlyoverProps {
  recording: boolean;
  terrain: TerrainData;
  exaggeration: number;
  onDone: () => void;
  onAnimatingChange?: (animating: boolean) => void;
}

function geoToMeshPos(
  lat: number,
  lon: number,
  bounds: GeoBounds,
  terrain: TerrainData,
  exaggeration: number,
): [number, number, number] | null {
  const meshWidth = 10;
  const meshHeight = 10 * (terrain.height / terrain.width);
  const { minLon, maxLon, minLat, maxLat } = bounds;
  const nx = (lon - minLon) / (maxLon - minLon);
  const ny = (lat - minLat) / (maxLat - minLat);
  const x = (nx - 0.5) * meshWidth;
  const planeY = (ny - 0.5) * meshHeight;

  let zHeight = 0;
  if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) {
    const pixelX = Math.floor(nx * (terrain.width - 1));
    const pixelY = Math.floor((1 - ny) * (terrain.height - 1));
    const idx = pixelY * terrain.width + pixelX;
    let elev = terrain.elevations[idx] || terrain.minElevation;
    if (terrain.noDataValue !== null && elev === terrain.noDataValue) {
      elev = terrain.minElevation;
    }
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const normalized = (elev - terrain.minElevation) / elevRange;
    const maxMeshHeight = 10 * (exaggeration / 100);
    zHeight = normalized * maxMeshHeight;
  }

  return [x, zHeight, -planeY];
}

const RiverFlyover = ({ recording, terrain, exaggeration, onDone, onAnimatingChange }: RiverFlyoverProps) => {
  const { camera, gl } = useThree();
  const riverPath = useRef<THREE.Vector3[] | null>(null);
  const pathLoaded = useRef(false);
  const progress = useRef(0);
  const active = useRef(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const pendingStart = useRef(false);

  const totalDuration = 15;
  const cameraHeight = 0.8; // closer to river
  const lookAheadSamples = 10;

  const startFlyover = useCallback(() => {
    const path = riverPath.current;
    if (!path || path.length < 2 || active.current) return;

    active.current = true;
    progress.current = 0;
    chunks.current = [];
    onAnimatingChange?.(true);

    // Position camera at start
    camera.position.copy(path[0]);
    const lookIdx = Math.min(lookAheadSamples, path.length - 1);
    camera.lookAt(path[lookIdx]);

    // Start recording
    const stream = gl.domElement.captureStream(30);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 8_000_000,
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'amu-darya-flyover.webm';
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      active.current = false;
      onAnimatingChange?.(false);
      onDone();
    };
    recorder.start();
    mediaRecorder.current = recorder;
  }, [camera, gl, onDone, onAnimatingChange]);

  // Preload river path on mount
  useEffect(() => {
    fetch('/data/AmuRivers.geojson')
      .then(r => r.json())
      .then(data => {
        const bounds = terrain.bounds;
        if (!bounds) return;

        let mainFeature = data.features[0];
        let maxOrder = 0;
        for (const f of data.features) {
          const order = f.properties?.sorder || 0;
          if (order > maxOrder) {
            maxOrder = order;
            mainFeature = f;
          }
        }
        if (maxOrder === 0) {
          let maxLen = 0;
          for (const f of data.features) {
            if (f.geometry.type === 'LineString') {
              const len = f.geometry.coordinates.length;
              if (len > maxLen) {
                maxLen = len;
                mainFeature = f;
              }
            }
          }
        }

        const coords = mainFeature.geometry.coordinates as number[][];
        const points: THREE.Vector3[] = [];
        for (const coord of coords) {
          const pos = geoToMeshPos(coord[1], coord[0], bounds, terrain, exaggeration);
          if (pos) {
            points.push(new THREE.Vector3(pos[0], pos[1] + cameraHeight, pos[2]));
          }
        }

        // Fly toward Aral Sea (north = lower z)
        if (points.length >= 2 && points[points.length - 1].z > points[0].z) {
          points.reverse();
        }

        // Subsample for smoothness
        if (points.length > 300) {
          const step = points.length / 300;
          const sampled: THREE.Vector3[] = [];
          for (let i = 0; i < 300; i++) {
            sampled.push(points[Math.floor(i * step)]);
          }
          sampled.push(points[points.length - 1]);
          riverPath.current = sampled;
        } else {
          riverPath.current = points;
        }
        pathLoaded.current = true;

        // If recording was requested before path loaded, start now
        if (pendingStart.current) {
          pendingStart.current = false;
          startFlyover();
        }
      })
      .catch(err => console.warn('Failed to load river path:', err));
  }, [terrain, exaggeration, startFlyover]);

  // Handle recording trigger
  useEffect(() => {
    if (recording && !active.current) {
      if (pathLoaded.current) {
        startFlyover();
      } else {
        pendingStart.current = true;
      }
    }
  }, [recording, startFlyover]);

  useFrame((_, delta) => {
    if (!active.current || !riverPath.current || riverPath.current.length < 2) return;
    const path = riverPath.current;

    progress.current += delta / totalDuration;
    const p = Math.min(progress.current, 1);

    // Ease in-out
    const eased = p < 0.5
      ? 2 * p * p
      : 1 - Math.pow(-2 * p + 2, 2) / 2;

    const pathLength = path.length - 1;
    const exactIndex = eased * pathLength;
    const i = Math.floor(exactIndex);
    const frac = exactIndex - i;

    const i0 = Math.min(i, pathLength);
    const i1 = Math.min(i + 1, pathLength);

    const pos = new THREE.Vector3().lerpVectors(path[i0], path[i1], frac);
    camera.position.copy(pos);

    // Look ahead
    const lookIdx = Math.min(i + lookAheadSamples, pathLength);
    const lookTarget = path[lookIdx].clone();
    lookTarget.y -= cameraHeight * 0.3;
    camera.lookAt(lookTarget);

    if (p >= 1) {
      mediaRecorder.current?.stop();
    }
  });

  return null;
};

export default RiverFlyover;
