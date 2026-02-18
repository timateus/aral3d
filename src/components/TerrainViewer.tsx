import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import TerrainMesh from './TerrainMesh';
import GeoFeatures from './GeoFeatures';
import { TerrainData } from '@/lib/geotiff-loader';
import * as THREE from 'three';

export interface TerrainViewerHandle {
  screenshot: () => void;
  recordVideo: () => void;
}

interface TerrainViewerProps {
  terrain: TerrainData;
  exaggeration: number;
  waterLevel: number;
  showBorders: boolean;
  showRivers: boolean;
  started: boolean;
  onWaterLevelChange?: (level: number) => void;
  recording?: boolean;
  onRecordingDone?: () => void;
}

function CameraAnimator({ started }: { started: boolean }) {
  const { camera } = useThree();
  const progress = useRef(0);
  const animating = useRef(false);
  const hasStarted = useRef(false);

  const start = new THREE.Vector3(18, 16, 18);
  const end = new THREE.Vector3(0, 10, 12);
  const startTarget = new THREE.Vector3(0, 0, 0);
  const endTarget = new THREE.Vector3(0, 0, -1);

  useEffect(() => {
    camera.position.copy(start);
    camera.lookAt(startTarget);
  }, []);

  useEffect(() => {
    if (started && !hasStarted.current) {
      hasStarted.current = true;
      animating.current = true;
      progress.current = 0;
    }
  }, [started]);

  useFrame((_, delta) => {
    if (!animating.current) return;
    progress.current = Math.min(progress.current + delta * 0.15, 1);
    const t = 1 - Math.pow(1 - progress.current, 3);

    camera.position.lerpVectors(start, end, t);
    const target = new THREE.Vector3().lerpVectors(startTarget, endTarget, t);
    camera.lookAt(target);

    if (progress.current >= 1) animating.current = false;
  });

  return null;
}

function ScreenshotHelper({ onReady }: { onReady: (fn: () => void) => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    onReady(() => {
      gl.render(scene, camera);
      const dataUrl = gl.domElement.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'aral-sea-terrain.png';
      link.href = dataUrl;
      link.click();
    });
  }, [gl, scene, camera, onReady]);
  return null;
}

function VideoAnimator({
  recording,
  onWaterLevelChange,
  onDone,
}: {
  recording: boolean;
  onWaterLevelChange: (level: number) => void;
  onDone: () => void;
}) {
  const { camera, gl } = useThree();
  const progress = useRef(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const active = useRef(false);

  // Total animation: phase1 = camera flyover (0-0.5), phase2 = water level + rotate (0.5-1.0)
  const totalDuration = 12; // seconds

  const flyStart = new THREE.Vector3(18, 16, 18);
  const flyEnd = new THREE.Vector3(0, 10, 12);
  const flyTargetStart = new THREE.Vector3(0, 0, 0);
  const flyTargetEnd = new THREE.Vector3(0, 0, -1);

  useEffect(() => {
    if (recording && !active.current) {
      active.current = true;
      progress.current = 0;
      chunks.current = [];

      // Reset camera
      camera.position.copy(flyStart);
      camera.lookAt(flyTargetStart);

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
        link.download = 'aral-sea-flyover.webm';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        active.current = false;
        onDone();
      };
      recorder.start();
      mediaRecorder.current = recorder;
    }
  }, [recording]);

  useFrame((_, delta) => {
    if (!active.current) return;

    progress.current += delta / totalDuration;
    const p = Math.min(progress.current, 1);

    if (p <= 0.5) {
      // Phase 1: Camera flyover (0 -> 0.5 maps to 0 -> 1)
      const t = p / 0.5;
      const eased = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(flyStart, flyEnd, eased);
      const target = new THREE.Vector3().lerpVectors(flyTargetStart, flyTargetEnd, eased);
      camera.lookAt(target);
    } else {
      // Phase 2: Water level 44 -> 29 + camera orbit
      const t = (p - 0.5) / 0.5;
      const eased = 1 - Math.pow(1 - t, 2);

      // Water level interpolation
      const wl = 44 - (44 - 29) * eased;
      onWaterLevelChange(Math.round(wl));

      // Gentle orbit around the terrain
      const angle = t * Math.PI * 0.6;
      const radius = 12;
      const height = 10 - t * 2;
      camera.position.set(
        Math.sin(angle) * radius,
        height,
        Math.cos(angle) * radius
      );
      camera.lookAt(0, 0, -1);
    }

    if (p >= 1) {
      mediaRecorder.current?.stop();
    }
  });

  return null;
}

const TerrainViewer = forwardRef<TerrainViewerHandle, TerrainViewerProps>(({ terrain, exaggeration, waterLevel, showBorders, showRivers, started, onWaterLevelChange, recording, onRecordingDone }, ref) => {
  const screenshotFn = useRef<(() => void) | null>(null);

  useImperativeHandle(ref, () => ({
    screenshot: () => screenshotFn.current?.(),
    recordVideo: () => {},
  }));

  return (
    <Canvas
      camera={{ position: [18, 16, 18], fov: 50, near: 0.1, far: 1000 }}
      className="w-full h-full"
      gl={{ antialias: true, toneMapping: 3, preserveDrawingBuffer: true }}
    >
      <color attach="background" args={['#0d1117']} />
      <fog attach="fog" args={['#0d1117', 20, 50]} />
      
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-3, 5, -3]} intensity={0.4} color="#8ec8e8" />

      <TerrainMesh terrain={terrain} exaggeration={exaggeration} waterLevel={waterLevel} />
      <GeoFeatures terrain={terrain} exaggeration={exaggeration} showBorders={showBorders} showRivers={showRivers} />

      <CameraAnimator started={started} />
      <ScreenshotHelper onReady={(fn) => { screenshotFn.current = fn; }} />
      {recording && onWaterLevelChange && onRecordingDone && (
        <VideoAnimator
          recording={recording}
          onWaterLevelChange={onWaterLevelChange}
          onDone={onRecordingDone}
        />
      )}

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2.1}
      />

      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport labelColor="white" axisHeadScale={0.8} />
      </GizmoHelper>

      <gridHelper args={[20, 20, '#1a2332', '#1a2332']} position={[0, -0.01, 0]} />
    </Canvas>
  );
});

TerrainViewer.displayName = 'TerrainViewer';

export default TerrainViewer;
