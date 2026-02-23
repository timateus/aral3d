import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface NarrativeCameraControllerProps {
  active: boolean;
  position: [number, number, number];
  target: [number, number, number];
}

const NarrativeCameraController = ({ active, position, target }: NarrativeCameraControllerProps) => {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(...position));
  const targetLook = useRef(new THREE.Vector3(...target));
  const currentLook = useRef(new THREE.Vector3(...target));

  useEffect(() => {
    if (active) {
      targetPos.current.set(...position);
      targetLook.current.set(...target);
    }
  }, [active, position, target]);

  useFrame(() => {
    if (!active) return;
    camera.position.lerp(targetPos.current, 0.03);
    currentLook.current.lerp(targetLook.current, 0.03);
    camera.lookAt(currentLook.current);
  });

  return null;
};

export default NarrativeCameraController;
