import { useRef, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import type { VoxelWorld } from '@/lib/voxel/voxel-world';
import { getColumnHeight, breakTopBlock, placeTopBlock } from '@/lib/voxel/voxel-world';
import type { BlockId } from '@/lib/voxel/block-types';
import { BLOCKS } from '@/lib/voxel/block-types';
import { useGamepad } from '@/hooks/useGamepad';

interface Props {
  world: VoxelWorld;
  onWorldMutated: () => void;
  onMined: (block: BlockId) => void;
  getSelectedBlock: () => BlockId | null;
  consumeSelected: () => BlockId | null;
  onLockChange?: (locked: boolean) => void;
}

const GRAVITY = 22;
const JUMP_V = 8.5;
const WALK_SPEED = 6;
const SPRINT_MULT = 1.6;
const EYE_HEIGHT = 1.6;
const PLAYER_RADIUS = 0.3;
const REACH = 8;

const VoxelPlayer = ({ world, onWorldMutated, onMined, getSelectedBlock, consumeSelected, onLockChange }: Props) => {
  const { camera, gl } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const onGround = useRef(false);
  const keys = useRef<Record<string, boolean>>({});
  const lockedRef = useRef(false);
  const lastClickTime = useRef(0);
  const gp = useGamepad();
  const lastGpClick = useRef({ break: false, place: false, jump: false });

  // Spawn at world center, on top of terrain.
  useEffect(() => {
    const i = Math.floor(world.width / 2);
    const j = Math.floor(world.depth / 2);
    const h = getColumnHeight(world, i, j);
    camera.position.set(0.5, h + EYE_HEIGHT + 0.1, 0.5);
    camera.rotation.set(0, 0, 0);
  }, [camera, world]);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === 'Space') e.preventDefault();
      // Hotbar select 1-9
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 9) {
          window.dispatchEvent(new CustomEvent('voxel:hotbar-select', { detail: n - 1 }));
        }
      }
      if (e.code === 'KeyE') {
        window.dispatchEvent(new CustomEvent('voxel:toggle-inventory'));
      }
    };
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // World ray pick: returns {i, j, hitFromAbove} of the column under crosshair, within REACH.
  const pickColumn = useCallback((): { i: number; j: number; faceY: number } | null => {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = camera.position.clone();
    const halfW = world.width / 2;
    const halfD = world.depth / 2;
    // March step
    const step = 0.25;
    for (let t = 0; t < REACH; t += step) {
      const p = origin.clone().addScaledVector(dir, t);
      const i = Math.floor(p.x + halfW);
      const j = Math.floor(p.z + halfD);
      if (i < 0 || i >= world.width || j < 0 || j >= world.depth) continue;
      const h = getColumnHeight(world, i, j);
      if (h === 0) continue;
      const topY = h; // top surface y
      if (p.y <= topY) return { i, j, faceY: topY };
    }
    return null;
  }, [camera, world]);

  const doBreak = useCallback(() => {
    const hit = pickColumn();
    if (!hit) return;
    const removed = breakTopBlock(world, hit.i, hit.j);
    if (removed && removed !== 'air') {
      onMined(removed);
      onWorldMutated();
    }
  }, [pickColumn, world, onMined, onWorldMutated]);

  const doPlace = useCallback(() => {
    const block = getSelectedBlock();
    if (!block) return;
    const hit = pickColumn();
    if (!hit) return;
    const ok = placeTopBlock(world, hit.i, hit.j, block);
    if (ok) {
      consumeSelected();
      onWorldMutated();
    }
  }, [pickColumn, world, getSelectedBlock, consumeSelected, onWorldMutated]);

  // Click handlers (need pointer lock)
  useEffect(() => {
    const canvas = gl.domElement;
    const onClick = (e: MouseEvent) => {
      if (!lockedRef.current) return;
      // Throttle rapid clicks
      const now = performance.now();
      if (now - lastClickTime.current < 80) return;
      lastClickTime.current = now;
      if (e.button === 0) doBreak();
      else if (e.button === 2) doPlace();
    };
    const onContext = (e: Event) => { e.preventDefault(); };
    canvas.addEventListener('mousedown', onClick);
    canvas.addEventListener('contextmenu', onContext);
    return () => {
      canvas.removeEventListener('mousedown', onClick);
      canvas.removeEventListener('contextmenu', onContext);
    };
  }, [gl, doBreak, doPlace]);

  // Physics + movement
  const tmpForward = new THREE.Vector3();
  const tmpRight = new THREE.Vector3();
  const moveDir = new THREE.Vector3();

  useFrame((_, delta) => {
    const gs = gp.stateRef.current;
    if (!lockedRef.current && !gs.connected) return;
    const dt = Math.min(0.05, delta);

    // Movement input
    moveDir.set(0, 0, 0);
    if (keys.current['KeyW']) moveDir.z -= 1;
    if (keys.current['KeyS']) moveDir.z += 1;
    if (keys.current['KeyA']) moveDir.x -= 1;
    if (keys.current['KeyD']) moveDir.x += 1;

    // Gamepad left stick
    if (gs.connected) {
      moveDir.x += gs.leftStick.x;
      moveDir.z += gs.leftStick.y;
      // Right stick yaw / pitch
      const lookSens = 1.8 * dt;
      camera.rotateY(-gs.rightStick.x * lookSens);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      camera.rotateOnWorldAxis(right, -gs.rightStick.y * lookSens);
    }

    if (moveDir.lengthSq() > 0) moveDir.normalize();

    const sprint = keys.current['ShiftLeft'] || keys.current['ShiftRight'] || gs.buttons.lb;
    const speed = WALK_SPEED * (sprint ? SPRINT_MULT : 1);

    // Camera-relative basis (XZ plane only)
    camera.getWorldDirection(tmpForward);
    tmpForward.y = 0; tmpForward.normalize();
    tmpRight.crossVectors(tmpForward, new THREE.Vector3(0, 1, 0)).normalize();

    velocity.current.x = (tmpRight.x * moveDir.x + tmpForward.x * -moveDir.z) * speed;
    velocity.current.z = (tmpRight.z * moveDir.x + tmpForward.z * -moveDir.z) * speed;

    // Jump
    const jumpPressed = keys.current['Space'] || gs.buttons.a;
    if (jumpPressed && onGround.current) {
      velocity.current.y = JUMP_V;
      onGround.current = false;
    }

    // Gravity
    velocity.current.y -= GRAVITY * dt;

    // Tentative new position
    const pos = camera.position;
    let nx = pos.x + velocity.current.x * dt;
    let ny = pos.y + velocity.current.y * dt;
    let nz = pos.z + velocity.current.z * dt;

    // Heightfield collision: keep player above terrain surface.
    const halfW = world.width / 2;
    const halfD = world.depth / 2;
    const ground = (x: number, z: number) => {
      const i = Math.floor(x + halfW);
      const j = Math.floor(z + halfD);
      return getColumnHeight(world, i, j);
    };

    // Sample ground at 4 corners around player radius
    const checkPoints = [
      [nx + PLAYER_RADIUS, nz + PLAYER_RADIUS],
      [nx - PLAYER_RADIUS, nz + PLAYER_RADIUS],
      [nx + PLAYER_RADIUS, nz - PLAYER_RADIUS],
      [nx - PLAYER_RADIUS, nz - PLAYER_RADIUS],
    ];
    let maxGround = 0;
    for (const [x, z] of checkPoints) maxGround = Math.max(maxGround, ground(x, z));

    const feet = ny - EYE_HEIGHT;
    if (feet < maxGround) {
      // Block horizontal movement if it caused a wall (compare to current ground).
      const curGround = ground(pos.x, pos.z);
      if (maxGround - curGround > 1.1) {
        // Wall: reject horizontal movement, keep current x/z
        nx = pos.x; nz = pos.z;
        // Recompute ground at current position
        maxGround = curGround;
      }
      ny = maxGround + EYE_HEIGHT;
      if (velocity.current.y < 0) velocity.current.y = 0;
      onGround.current = true;
    } else if (feet > maxGround + 0.01) {
      onGround.current = false;
    }

    // Stay in bounds
    const margin = 1;
    nx = Math.max(-halfW + margin, Math.min(halfW - margin, nx));
    nz = Math.max(-halfD + margin, Math.min(halfD - margin, nz));

    pos.set(nx, ny, nz);

    // Gamepad button-edge actions
    if (gs.connected) {
      const rtPressed = gs.buttons.rt > 0.5;
      const ltPressed = gs.buttons.lt > 0.5;
      if (rtPressed && !lastGpClick.current.break) doBreak();
      if (ltPressed && !lastGpClick.current.place) doPlace();
      lastGpClick.current.break = rtPressed;
      lastGpClick.current.place = ltPressed;
    }
  });

  return (
    <PointerLockControls
      onLock={() => { lockedRef.current = true; onLockChange?.(true); }}
      onUnlock={() => { lockedRef.current = false; onLockChange?.(false); }}
    />
  );
};

export default VoxelPlayer;
