import { useRef, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import type { VoxelWorld } from '@/lib/voxel/voxel-world';
import { getColumnHeight, breakTopBlock, placeTopBlock } from '@/lib/voxel/voxel-world';
import type { BlockId } from '@/lib/voxel/block-types';
import { BLOCKS } from '@/lib/voxel/block-types';
import { useGamepad } from '@/hooks/useGamepad';
import { playSfx } from '@/lib/voxel/voxel-audio';
import { dispatchMissionEvent } from '@/hooks/useVoxelMissions';
import { setStatsRaw, getStatsSnapshot } from '@/hooks/useVoxelStats';
import { touchInput, isTouchDevice } from '@/lib/voxel/touch-input';

interface Props {
  world: VoxelWorld;
  onWorldMutated: () => void;
  onMined: (block: BlockId) => void;
  getSelectedBlock: () => BlockId | null;
  consumeSelected: () => BlockId | null;
  onLockChange?: (locked: boolean) => void;
  playerRef?: React.MutableRefObject<{ x: number; z: number; yaw: number }>;
  canAct?: () => boolean;
  onActionConsumed?: (kind: 'break' | 'place') => void;
}

const GRAVITY = 22;
const JUMP_V = 8.5;
const WALK_SPEED = 6;
const SPRINT_MULT = 1.6;
const EYE_HEIGHT = 1.6;
const PLAYER_RADIUS = 0.3;
const REACH = 8;

const VoxelPlayer = ({ world, onWorldMutated, onMined, getSelectedBlock, consumeSelected, onLockChange, playerRef, canAct, onActionConsumed }: Props) => {
  const { camera, gl } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const onGround = useRef(false);
  const keys = useRef<Record<string, boolean>>({});
  const lockedRef = useRef(false);
  const lastClickTime = useRef(0);
  const gp = useGamepad();
  const lastGpClick = useRef({ break: false, place: false, jump: false, inv: false, topdown: false });
  // Hold-to-repeat: after holding the button > HOLD_MS, fire every REPEAT_MS.
  const holdRef = useRef<{ break: number | null; place: number | null }>({ break: null, place: null });
  const lastRepeatRef = useRef<{ break: number; place: number }>({ break: 0, place: 0 });

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
      if (e.code === 'KeyQ') {
        window.dispatchEvent(new CustomEvent('voxel:toggle-quests'));
      }
      if (e.code === 'KeyB') {
        window.dispatchEvent(new CustomEvent('voxel:toggle-build'));
      }
      if (e.code === 'KeyF') {
        window.dispatchEvent(new CustomEvent('voxel:interact'));
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
    // Breaking does NOT consume the action budget — only placing does.
    // Let mobs (camels, sheep, etc.) handle left-click first if the crosshair is on them.
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const handled = { value: false };
    window.dispatchEvent(new CustomEvent('voxel:left-click', {
      detail: { pos: camera.position.toArray(), dir: dir.toArray(), handled },
    }));
    if (handled.value) return;

    const hit = pickColumn();
    if (!hit) return;
    const removed = breakTopBlock(world, hit.i, hit.j);
    if (removed && removed !== 'air') {
      onMined(removed);
      dispatchMissionEvent({ type: 'mine', block: removed });
      onActionConsumed?.('break');
      window.dispatchEvent(new CustomEvent('voxel:column-dirty', { detail: { i: hit.i, j: hit.j } }));
      onWorldMutated();
    }
  }, [camera, pickColumn, world, onMined, onWorldMutated, onActionConsumed]);

  const doPlace = useCallback(() => {
    if (canAct && !canAct()) return; // place is the action that's capped
    const block = getSelectedBlock();
    if (!block) return;
    const hit = pickColumn();
    if (!hit) return;
    // Detect surface block for sapling-on-sand mission
    const surfaceBlock = world.palette[world.cells[(hit.j * world.width + hit.i) * world.maxStackHeight + (world.heights[hit.j * world.width + hit.i] - 1)]];
    const ok = placeTopBlock(world, hit.i, hit.j, block);
    if (ok) {
      consumeSelected();
      dispatchMissionEvent({ type: 'place', block });
      onActionConsumed?.('place');
      window.dispatchEvent(new CustomEvent('voxel:column-dirty', { detail: { i: hit.i, j: hit.j } }));
      if (block === 'salt') {
        window.dispatchEvent(new CustomEvent('voxel:salt-placed', { detail: { i: hit.i, j: hit.j } }));
      }
      if (block === 'sapling' && (surfaceBlock === 'sand' || surfaceBlock === 'salt')) {
        dispatchMissionEvent({ type: 'plant-sapling' });
        window.dispatchEvent(new CustomEvent('voxel:sapling-planted', { detail: { i: hit.i, j: hit.j } }));
      }
      onWorldMutated();
    }
  }, [pickColumn, world, getSelectedBlock, consumeSelected, onWorldMutated, canAct, onActionConsumed]);

  // F = interact (drink/eat)
  useEffect(() => {
    const onInteract = () => {
      // Drink from water column under crosshair
      const hit = pickColumn();
      if (hit) {
        const idx = hit.j * world.width + hit.i;
        const h = world.heights[idx];
        if (h > 0) {
          const top = world.palette[world.cells[idx * world.maxStackHeight + h - 1]];
          if (top === 'water') {
            const s = getStatsSnapshot();
            setStatsRaw({ thirst: s.thirst + 30 });
            dispatchMissionEvent({ type: 'drink' });
            playSfx('drink');
            return;
          }
        }
      }
      // Otherwise, try to eat flatbread/milk/fish from inventory
      window.dispatchEvent(new CustomEvent('voxel:try-eat'));
    };
    window.addEventListener('voxel:interact', onInteract);
    return () => window.removeEventListener('voxel:interact', onInteract);
  }, [pickColumn, world]);

  // Mouse click handlers (need pointer lock). Hold > 2s to auto-repeat.
  useEffect(() => {
    const canvas = gl.domElement;
    const onDown = (e: MouseEvent) => {
      if (!lockedRef.current) return;
      const now = performance.now();
      if (now - lastClickTime.current < 80) return;
      lastClickTime.current = now;
      if (e.button === 0) { doBreak(); holdRef.current.break = now; lastRepeatRef.current.break = now; }
      else if (e.button === 2) { doPlace(); holdRef.current.place = now; lastRepeatRef.current.place = now; }
    };
    const onUp = (e: MouseEvent) => {
      if (e.button === 0) holdRef.current.break = null;
      if (e.button === 2) holdRef.current.place = null;
    };
    const onContext = (e: Event) => { e.preventDefault(); };
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('contextmenu', onContext);
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('contextmenu', onContext);
    };
  }, [gl, doBreak, doPlace]);

  // Physics + movement
  const tmpForward = new THREE.Vector3();
  const tmpRight = new THREE.Vector3();
  const moveDir = new THREE.Vector3();

  useFrame((_, delta) => {
    const gs = gp.stateRef.current;
    const touch = touchInput.active;
    if (!lockedRef.current && !gs.connected && !touch) return;
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

    // Touch input
    if (touch) {
      moveDir.x += touchInput.move.x;
      moveDir.z += touchInput.move.y;
      // Drag-look: consume accumulated pixel deltas
      const lookSens = 0.0035;
      if (touchInput.look.x || touchInput.look.y) {
        camera.rotateY(-touchInput.look.x * lookSens);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        camera.rotateOnWorldAxis(right, -touchInput.look.y * lookSens);
        // Clamp pitch
        const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        e.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, e.x));
        camera.quaternion.setFromEuler(e);
        touchInput.look.x = 0; touchInput.look.y = 0;
      }
      if (touchInput.breakQueued) { touchInput.breakQueued = false; doBreak(); }
      if (touchInput.placeQueued) { touchInput.placeQueued = false; doPlace(); }
    }

    if (moveDir.lengthSq() > 0) moveDir.normalize();

    // Sprint via keyboard shift (face buttons are remapped to actions).
    const sprint = keys.current['ShiftLeft'] || keys.current['ShiftRight'] || touchInput.sprint;
    const speed = WALK_SPEED * (sprint ? SPRINT_MULT : 1);

    // Camera-relative basis (XZ plane only)
    camera.getWorldDirection(tmpForward);
    tmpForward.y = 0; tmpForward.normalize();
    tmpRight.crossVectors(tmpForward, new THREE.Vector3(0, 1, 0)).normalize();

    velocity.current.x = (tmpRight.x * moveDir.x + tmpForward.x * -moveDir.z) * speed;
    velocity.current.z = (tmpRight.z * moveDir.x + tmpForward.z * -moveDir.z) * speed;

    // Jump
    // Jump via Space or LB (A is repurposed for top-down view).
    const jumpPressed = keys.current['Space'] || gs.buttons.lb || touchInput.jumpQueued;
    if (touchInput.jumpQueued) touchInput.jumpQueued = false;
    if (jumpPressed && onGround.current) {
      velocity.current.y = JUMP_V;
      onGround.current = false;
      playSfx('jump');
    }

    // Gravity
    velocity.current.y -= GRAVITY * dt;

    // Tentative new position with per-axis collision + step-up
    const pos = camera.position;
    const halfW = world.width / 2;
    const halfD = world.depth / 2;
    const ground = (x: number, z: number) => {
      const i = Math.floor(x + halfW);
      const j = Math.floor(z + halfD);
      return getColumnHeight(world, i, j);
    };
    const sampleGround = (x: number, z: number) =>
      Math.max(
        ground(x + PLAYER_RADIUS, z + PLAYER_RADIUS),
        ground(x - PLAYER_RADIUS, z + PLAYER_RADIUS),
        ground(x + PLAYER_RADIUS, z - PLAYER_RADIUS),
        ground(x - PLAYER_RADIUS, z - PLAYER_RADIUS),
      );

    const STEP_UP = 1.05; // climb a single block automatically
    const curGround = sampleGround(pos.x, pos.z);
    const standing = pos.y - EYE_HEIGHT <= curGround + 0.05;

    // Axis-separated movement so we slide along walls instead of getting stuck
    let nx = pos.x + velocity.current.x * dt;
    let nz = pos.z;
    if (standing && sampleGround(nx, nz) - curGround > STEP_UP) nx = pos.x;

    nz = pos.z + velocity.current.z * dt;
    if (standing && sampleGround(nx, nz) - sampleGround(nx, pos.z) > STEP_UP) nz = pos.z;

    let ny = pos.y + velocity.current.y * dt;
    const finalGround = sampleGround(nx, nz);
    if (ny - EYE_HEIGHT < finalGround) {
      ny = finalGround + EYE_HEIGHT;
      if (velocity.current.y < 0) velocity.current.y = 0;
      onGround.current = true;
    } else if (ny - EYE_HEIGHT > finalGround + 0.02) {
      onGround.current = false;
    }

    // Stay in bounds
    const margin = 1;
    nx = Math.max(-halfW + margin, Math.min(halfW - margin, nx));
    nz = Math.max(-halfD + margin, Math.min(halfD - margin, nz));

    pos.set(nx, ny, nz);

    // Gamepad face-button remap:
    //   1 (A) = top-down zoom-out toggle
    //   2 (B) = destroy (break)
    //   3 (X) = build  (place)
    //   4 (Y) = choose material (toggle inventory)
    // RB/LB still trigger break/place as legacy shoulder shortcuts; RT/LT keep zoom.
    if (gs.connected) {
      const breakPressed = gs.buttons.b || gs.buttons.rb;
      const placePressed = gs.buttons.x || gs.buttons.lb;
      const invPressed   = gs.buttons.y;
      const topPressed   = gs.buttons.a;
      const nowMs = performance.now();
      if (breakPressed && !lastGpClick.current.break) { doBreak(); holdRef.current.break = nowMs; lastRepeatRef.current.break = nowMs; }
      if (!breakPressed && lastGpClick.current.break) holdRef.current.break = null;
      if (placePressed && !lastGpClick.current.place) { doPlace(); holdRef.current.place = nowMs; lastRepeatRef.current.place = nowMs; }
      if (!placePressed && lastGpClick.current.place) holdRef.current.place = null;
      if (invPressed && !lastGpClick.current.inv) window.dispatchEvent(new CustomEvent('voxel:toggle-inventory'));
      if (topPressed && !lastGpClick.current.topdown) window.dispatchEvent(new CustomEvent('voxel:toggle-topdown'));
      lastGpClick.current.break = breakPressed;
      lastGpClick.current.place = placePressed;
      lastGpClick.current.inv = invPressed;
      lastGpClick.current.topdown = topPressed;

      // R2/L2 zoom: dispatch a delta to the parent each frame while held.
      const rt = gs.buttons.rt, lt = gs.buttons.lt;
      if (rt > 0.1 || lt > 0.1) {
        const zoomDelta = (rt - lt) * dt * 1.8;
        window.dispatchEvent(new CustomEvent('voxel:zoom', { detail: { delta: zoomDelta } }));
      }
    }

    // Hold-to-repeat (2s hold → repeat every 250ms) for mouse and gamepad
    const HOLD_MS = 2000, REPEAT_MS = 250;
    const tNow = performance.now();
    if (holdRef.current.break != null && tNow - holdRef.current.break > HOLD_MS &&
        tNow - lastRepeatRef.current.break > REPEAT_MS) {
      doBreak();
      lastRepeatRef.current.break = tNow;
    }
    if (holdRef.current.place != null && tNow - holdRef.current.place > HOLD_MS &&
        tNow - lastRepeatRef.current.place > REPEAT_MS) {
      doPlace();
      lastRepeatRef.current.place = tNow;
    }

    // Publish position for minimap / external HUDs
    if (playerRef) {
      const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      playerRef.current.x = pos.x;
      playerRef.current.z = pos.z;
      playerRef.current.yaw = -e.y; // canvas Y rotates opposite to world yaw
    }
  });

  // On touch devices, skip pointer lock entirely — touch controls drive input.
  useEffect(() => {
    if (isTouchDevice()) {
      lockedRef.current = true;
      onLockChange?.(true);
    }
  }, [onLockChange]);

  if (isTouchDevice()) return null;

  return (
    <PointerLockControls
      onLock={() => { lockedRef.current = true; onLockChange?.(true); }}
      onUnlock={() => { lockedRef.current = false; onLockChange?.(false); }}
    />
  );
};

export default VoxelPlayer;
