import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TerrainData } from '@/lib/geotiff-loader';
import { useGamepad } from '@/hooks/useGamepad';

interface Props {
  active: boolean;
  terrain: TerrainData;
  exaggeration: number;
  /** Called each frame with the character's current lat/lon (feet on ground). */
  onPositionChange?: (lat: number, lon: number) => void;
  /** Called whenever the "place" button transitions. */
  onTriggerChange?: (held: boolean) => void;
}

/**
 * First-person walker for Level 5 (Map Builder).
 * - Camera sticks to terrain surface (+ eye height).
 * - WASD / left-stick = walk, mouse / right-stick = look.
 * - Click canvas to capture pointer (mouse look).
 * - Mouse-left or Space or Gamepad-A / RT held → onTriggerChange(true) (continuous place).
 */
const EYE_HEIGHT = 0.18;
const WALK_SPEED = 2.8;     // mesh-units / second
const SPRINT_MULT = 2.2;
const LOOK_SENS_MOUSE = 0.0025;
const LOOK_SENS_PAD = 1.8;

const FirstPersonController = ({ active, terrain, exaggeration, onPositionChange, onTriggerChange }: Props) => {
  const { camera, gl } = useThree();
  const { stateRef: gpRef } = useGamepad();
  const yaw = useRef(0);
  const pitch = useRef(-0.05);
  const pos = useRef(new THREE.Vector3(0, EYE_HEIGHT, 0));
  const initialized = useRef(false);
  const savedCam = useRef<{ p: THREE.Vector3; q: THREE.Quaternion } | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const triggerHeld = useRef(false);
  const prevTrigger = useRef(false);

  const meshWidth = 10;
  const meshHeight = 10 * (terrain.height / terrain.width);

  const sampleHeight = (x: number, z: number) => {
    const nx = x / meshWidth + 0.5;
    const ny = -z / meshHeight + 0.5;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return 0;
    const px = Math.min(terrain.width - 1, Math.max(0, Math.floor(nx * (terrain.width - 1))));
    const py = Math.min(terrain.height - 1, Math.max(0, Math.floor((1 - ny) * (terrain.height - 1))));
    let elev = terrain.elevations[py * terrain.width + px] || terrain.minElevation;
    if (terrain.noDataValue !== null && elev === terrain.noDataValue) elev = terrain.minElevation;
    const range = terrain.maxElevation - terrain.minElevation || 1;
    return ((elev - terrain.minElevation) / range) * (10 * (exaggeration / 100));
  };

  const worldXZToLatLon = (x: number, z: number) => {
    const b = terrain.bounds;
    if (!b) return null;
    const nx = x / meshWidth + 0.5;
    const ny = -z / meshHeight + 0.5;
    const lon = b.minLon + nx * (b.maxLon - b.minLon);
    const lat = b.minLat + ny * (b.maxLat - b.minLat);
    return { lat, lon };
  };

  // Mount/unmount: save & restore camera, init position at a reasonable spawn.
  useEffect(() => {
    if (!active) return;
    savedCam.current = { p: camera.position.clone(), q: camera.quaternion.clone() };
    if (!initialized.current) {
      pos.current.set(0, 0, 0);
      yaw.current = 0;
      pitch.current = -0.1;
      initialized.current = true;
    }
    return () => {
      if (savedCam.current) {
        camera.position.copy(savedCam.current.p);
        camera.quaternion.copy(savedCam.current.q);
      }
      triggerHeld.current = false;
      prevTrigger.current = false;
      onTriggerChange?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Keyboard
  useEffect(() => {
    if (!active) return;
    const dn = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.current[k] = true;
      if (k === ' ') { e.preventDefault(); }
    };
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
      keys.current = {};
    };
  }, [active]);

  // Mouse look + pointer lock + mouse-button trigger
  useEffect(() => {
    if (!active) return;
    const el = gl.domElement;
    const onClick = () => {
      if (document.pointerLockElement !== el) el.requestPointerLock?.();
    };
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      yaw.current -= e.movementX * LOOK_SENS_MOUSE;
      pitch.current = THREE.MathUtils.clamp(pitch.current - e.movementY * LOOK_SENS_MOUSE, -1.2, 1.2);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest('[data-hud], button, a, input, select, textarea')) return;
      if (e.button === 0) { keys.current['__mouse'] = true; }
    };
    const onUp = (e: MouseEvent) => { if (e.button === 0) keys.current['__mouse'] = false; };
    el.addEventListener('click', onClick);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    return () => {
      el.removeEventListener('click', onClick);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      if (document.pointerLockElement === el) document.exitPointerLock?.();
    };
  }, [active, gl]);

  useFrame((_, dt) => {
    if (!active) return;
    const gp = gpRef.current;

    // ---- Look (right stick) ----
    if (gp.connected) {
      const rx = gp.rightStick.x;
      const ry = gp.rightStick.y;
      if (rx || ry) {
        yaw.current -= rx * LOOK_SENS_PAD * dt;
        pitch.current = THREE.MathUtils.clamp(pitch.current - ry * LOOK_SENS_PAD * dt, -1.2, 1.2);
      }
    }
    // Arrow keys also rotate (keyboard look fallback).
    if (keys.current['arrowleft']) yaw.current += 1.6 * dt;
    if (keys.current['arrowright']) yaw.current -= 1.6 * dt;
    if (keys.current['arrowup']) pitch.current = Math.min(1.2, pitch.current + 1.2 * dt);
    if (keys.current['arrowdown']) pitch.current = Math.max(-1.2, pitch.current - 1.2 * dt);

    // ---- Move (forward/strafe in yaw plane) ----
    let fwd = 0, str = 0;
    if (keys.current['w']) fwd += 1;
    if (keys.current['s']) fwd -= 1;
    if (keys.current['a']) str -= 1;
    if (keys.current['d']) str += 1;
    if (gp.connected) {
      fwd -= gp.leftStick.y; // up on stick = forward
      str += gp.leftStick.x;
    }
    const sprint = keys.current['shift'] || (gp.connected && gp.buttons.lb);
    const speed = WALK_SPEED * (sprint ? SPRINT_MULT : 1);
    if (fwd || str) {
      const mag = Math.min(1, Math.hypot(fwd, str));
      const dirX = Math.sin(yaw.current) * fwd + Math.cos(yaw.current) * str;
      const dirZ = Math.cos(yaw.current) * fwd - Math.sin(yaw.current) * str;
      const len = Math.hypot(dirX, dirZ) || 1;
      pos.current.x += (dirX / len) * speed * dt * mag;
      pos.current.z += (dirZ / len) * speed * dt * mag;
    }

    // Clamp inside the map.
    pos.current.x = THREE.MathUtils.clamp(pos.current.x, -meshWidth / 2 + 0.05, meshWidth / 2 - 0.05);
    pos.current.z = THREE.MathUtils.clamp(pos.current.z, -meshHeight / 2 + 0.05, meshHeight / 2 - 0.05);

    // Stick to terrain.
    const groundY = sampleHeight(pos.current.x, pos.current.z);
    pos.current.y = groundY + EYE_HEIGHT;

    // Apply to camera.
    camera.position.copy(pos.current);
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'));
    camera.quaternion.copy(quat);

    // Position callback (use feet position).
    if (onPositionChange) {
      const ll = worldXZToLatLon(pos.current.x, pos.current.z);
      if (ll) onPositionChange(ll.lat, ll.lon);
    }

    // Trigger (continuous place): mouse-left, Space, A button, or RT.
    const held =
      !!keys.current['__mouse'] ||
      !!keys.current[' '] ||
      !!keys.current['x'] ||
      !!keys.current['enter'] ||
      (gp.connected && (gp.buttons.a || gp.buttons.rt > 0.4));
    triggerHeld.current = held;
    if (held !== prevTrigger.current) {
      prevTrigger.current = held;
      onTriggerChange?.(held);
    }
  });

  return null;
};

export default FirstPersonController;
