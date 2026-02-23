import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Html } from '@react-three/drei';
import TerrainMesh from './TerrainMesh';
import GeoFeatures from './GeoFeatures';
import WaterExtentLayer from './WaterExtentLayer';
import NarrativeCameraController from './NarrativeCameraController';
import ScenarioOverlay from './ScenarioOverlay';
import RiverFlyover from './RiverFlyover';
import { TerrainData } from '@/lib/geotiff-loader';
import type { ScenarioAction } from '@/types/scenario';
import * as THREE from 'three';

export interface TerrainViewerHandle {
  screenshot: () => void;
  recordVideo: () => void;
}

interface MetricItem {
  name: string;
  value: number;
  unit: string;
  color: string;
}

interface TerrainViewerProps {
  terrain: TerrainData;
  exaggeration: number;
  waterLevel: number;
  showBorders: boolean;
  showRivers: boolean;
  show13thBasin: boolean;
  show19thBasin: boolean;
  show21stBasin: boolean;
  showWaterExtent: boolean;
  waterExtentYear: number;
  hideNoData?: boolean;
  waterBounds?: import('@/lib/geotiff-loader').GeoBounds | null;
  
  started: boolean;
  onWaterLevelChange?: (level: number) => void;
  recording?: boolean;
  onRecordingDone?: () => void;
  scenarioActions?: ScenarioAction[];
  currentMetrics?: MetricItem[];
  narrativeActive?: boolean;
  narrativeCameraPosition?: [number, number, number];
  narrativeCameraTarget?: [number, number, number];
  riverFlyover?: boolean;
  onRiverFlyoverDone?: () => void;
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

const TerrainViewer = forwardRef<TerrainViewerHandle, TerrainViewerProps>(({ terrain, exaggeration, waterLevel, showBorders, showRivers, show13thBasin, show19thBasin, show21stBasin, showWaterExtent, waterExtentYear, hideNoData, waterBounds, started, onWaterLevelChange, recording, onRecordingDone, scenarioActions, currentMetrics, narrativeActive, narrativeCameraPosition, narrativeCameraTarget }, ref) => {
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

      <TerrainMesh terrain={terrain} exaggeration={exaggeration} waterLevel={waterLevel} hideNoData={hideNoData} waterBounds={waterBounds} />
      <GeoFeatures terrain={terrain} exaggeration={exaggeration} showBorders={showBorders} showRivers={showRivers} show13thBasin={show13thBasin} show19thBasin={show19thBasin} show21stBasin={show21stBasin} />
      {showWaterExtent && <WaterExtentLayer terrain={terrain} exaggeration={exaggeration} year={waterExtentYear} />}
      {scenarioActions && scenarioActions.length > 0 && (
        <ScenarioOverlay actions={scenarioActions} terrain={terrain} exaggeration={exaggeration} />
      )}
      {showWaterExtent && (
        <group position={[0, 6, -2]}>
          <Html center distanceFactor={15} style={{ pointerEvents: 'none' }}>
            <div style={{
              textAlign: 'center',
              color: '#ffffff',
              textShadow: '0 2px 12px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.7)',
              fontFamily: "'Inter', system-ui, sans-serif",
            }}>
              <div style={{ fontSize: '72px', fontWeight: 700, lineHeight: 1 }}>
                {waterExtentYear}
              </div>
              <div style={{ fontSize: '22px', fontWeight: 400, color: '#8ec8e8', marginTop: '4px' }}>
                Water Level: {waterLevel} m
              </div>
              {currentMetrics && currentMetrics.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  gap: '6px 12px',
                  marginTop: '8px',
                  maxWidth: '400px',
                }}>
                  {currentMetrics.map(m => (
                    <div key={m.name} style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: m.color,
                      whiteSpace: 'nowrap',
                    }}>
                      {m.name.replace(/\s*\(.*\)/, '')}: <span style={{ color: '#fff', fontWeight: 600 }}>
                        {typeof m.value === 'number' ? (m.value >= 1000 ? m.value.toLocaleString() : m.value) : m.value}
                      </span>{' '}
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>{m.unit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Html>
        </group>
      )}

      {!narrativeActive && <CameraAnimator started={started} />}
      {narrativeActive && narrativeCameraPosition && narrativeCameraTarget && (
        <NarrativeCameraController
          active={narrativeActive}
          position={narrativeCameraPosition}
          target={narrativeCameraTarget}
        />
      )}
      <ScreenshotHelper onReady={(fn) => { screenshotFn.current = fn; }} />
      {recording && onWaterLevelChange && onRecordingDone && (
        <VideoAnimator
          recording={recording}
          onWaterLevelChange={onWaterLevelChange}
          onDone={onRecordingDone}
        />
      )}

      <OrbitControls
        enabled={!narrativeActive}
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
