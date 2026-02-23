import { useRef, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TerrainData, GeoBounds } from '@/lib/geotiff-loader';

interface RiverFlyoverProps {
  active: boolean;
  terrain: TerrainData;
  exaggeration: number;
  onDone: () => void;
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

const RiverFlyover = ({ active, terrain, exaggeration, onDone }: RiverFlyoverProps) => {
  const { camera, gl, scene } = useThree();
  const [riverPath, setRiverPath] = useState<THREE.Vector3[] | null>(null);
  const progress = useRef(0);
  const isActive = useRef(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const totalDuration = 15; // seconds
  const cameraHeight = 1.8; // height above terrain along the path
  const lookAheadSamples = 15; // how far ahead to look for camera direction

  // Load river path
  useEffect(() => {
    fetch('/data/AmuRivers.geojson')
      .then(r => r.json())
      .then(data => {
        const bounds = terrain.bounds;
        if (!bounds) return;

        // Find the main river (highest sorder or longest)
        let mainFeature = data.features[0];
        let maxOrder = 0;
        for (const f of data.features) {
          const order = f.properties?.sorder || 0;
          if (order > maxOrder) {
            maxOrder = order;
            mainFeature = f;
          }
        }

        // If main feature is not found by sorder, use the longest LineString
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

        // The river flows toward the Aral Sea — check if we need to reverse
        // We want to fly FROM the beginning (upstream) TO the Aral Sea (downstream)
        // The Aral Sea is roughly at higher latitude (north) i.e. lower z in mesh space
        if (points.length >= 2) {
          const first = points[0];
          const last = points[points.length - 1];
          // If last point is more south (higher z), reverse so we fly toward north (Aral Sea)
          if (last.z > first.z) {
            points.reverse();
          }
        }

        // Subsample to smooth path (~200 points)
        if (points.length > 200) {
          const step = points.length / 200;
          const sampled: THREE.Vector3[] = [];
          for (let i = 0; i < 200; i++) {
            sampled.push(points[Math.floor(i * step)]);
          }
          sampled.push(points[points.length - 1]);
          setRiverPath(sampled);
        } else {
          setRiverPath(points);
        }
      })
      .catch(err => console.warn('Failed to load river path:', err));
  }, [terrain, exaggeration]);

  // Start recording when active
  useEffect(() => {
    if (active && riverPath && riverPath.length >= 2 && !isActive.current) {
      isActive.current = true;
      progress.current = 0;
      chunks.current = [];

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
        isActive.current = false;
        onDone();
      };
      recorder.start();
      mediaRecorder.current = recorder;
    }
  }, [active, riverPath]);

  useFrame((_, delta) => {
    if (!isActive.current || !riverPath || riverPath.length < 2) return;

    progress.current += delta / totalDuration;
    const p = Math.min(progress.current, 1);

    // Ease in-out
    const eased = p < 0.5
      ? 2 * p * p
      : 1 - Math.pow(-2 * p + 2, 2) / 2;

    // Get position along path using CatmullRom curve
    const pathLength = riverPath.length - 1;
    const exactIndex = eased * pathLength;
    const i = Math.floor(exactIndex);
    const frac = exactIndex - i;

    const i0 = Math.min(i, pathLength);
    const i1 = Math.min(i + 1, pathLength);

    const pos = new THREE.Vector3().lerpVectors(riverPath[i0], riverPath[i1], frac);
    camera.position.copy(pos);

    // Look ahead along the path
    const lookIdx = Math.min(i + lookAheadSamples, pathLength);
    const lookTarget = riverPath[lookIdx].clone();
    // Look slightly below camera height for more cinematic angle
    lookTarget.y = lookTarget.y - cameraHeight * 0.5;
    camera.lookAt(lookTarget);

    if (p >= 1) {
      mediaRecorder.current?.stop();
    }
  });

  return null;
};

export default RiverFlyover;
