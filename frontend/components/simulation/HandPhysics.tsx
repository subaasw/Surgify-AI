"use client";

import { Suspense, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BallCollider, CuboidCollider, Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { SafeMedicalGLB } from "./ModelRegistry";
import { MODEL_PATHS } from "@/data/modelConfig";
import { handWorld, type Side } from "./GestureHandControl";

export const TOOL_ASSETS: Record<string, { path: string; rotation: [number, number, number] }> = {
  "Needle holder": { path: MODEL_PATHS.needleHolder, rotation: [Math.PI / 2, 0, 0] },
  Forceps: { path: MODEL_PATHS.forceps, rotation: [Math.PI / 2, 0, 0] },
  "Surgical scissors": { path: MODEL_PATHS.scissors, rotation: [0, 0, Math.PI / 2] },
  "Curved needle": { path: MODEL_PATHS.curvedNeedle, rotation: [Math.PI / 2, 0, 0] },
};

const TRAY_SPAWN: [number, number, number] = [2.8, 1.18, -.62];
const GRAB_RADIUS = .5; // pinch point must be this close (world units) to pick a tool up
const PARKED = { x: 0, y: -20, z: 0 }; // kinematic hand bodies wait here while untracked

// Rapier body-type enum values (RigidBodyType from @dimforge/rapier3d-compat)
const DYNAMIC = 0;
const KINEMATIC_POSITION = 2;

/**
 * Rapier layer for gesture control: static colliders for the room's resting
 * surfaces, a kinematic contact ball per hand at the pinch point, and the
 * selected instrument as a real rigid body — pinch near it to grab, open the
 * pinch to drop it and let gravity land it on the tray, patient, or floor.
 * All hand→object distance math runs through the physics world positions.
 */
export function SurgicalPhysics({ selectedTool, active }: { selectedTool: string | null; active: boolean }) {
  if (!active) return null;
  return <Suspense fallback={null}>
    <Physics colliders={false} timeStep="vary">
      {/* ponytail: three boxes stand in for tray, patient, floor — swap for mesh colliders if contact fidelity ever matters */}
      <CuboidCollider args={[.68, .03, .38]} position={[2.8, 1.05, -.62]} friction={.9} />
      <CuboidCollider args={[1.15, .28, 2.4]} position={[0, 1.45, 0]} friction={.9} />
      <CuboidCollider args={[7, .05, 6]} position={[0, -.05, 0]} />
      <PinchBody side="Right" />
      <PinchBody side="Left" />
      {selectedTool && TOOL_ASSETS[selectedTool] && <PhysicalInstrument key={selectedTool} tool={selectedTool} />}
    </Physics>
  </Suspense>;
}

/** Kinematic contact ball riding the hand's pinch point — lets the tracked hand physically push scene bodies. */
function PinchBody({ side }: { side: Side }) {
  const body = useRef<RapierRigidBody>(null);
  useFrame(() => {
    const hand = handWorld[side];
    body.current?.setNextKinematicTranslation(hand.live ? hand.pinchPoint : PARKED);
  });
  return <RigidBody ref={body} type="kinematicPosition" position={[PARKED.x, PARKED.y, PARKED.z]}>
    <BallCollider args={[.07]} friction={1} />
  </RigidBody>;
}

const gripOffset = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
const targetRot = new THREE.Quaternion();
const toolAt = new THREE.Vector3();

function PhysicalInstrument({ tool }: { tool: string }) {
  const body = useRef<RapierRigidBody>(null);
  const holder = useRef<Side | null>(null);
  const wasPinch = useRef<Record<Side, boolean>>({ Right: false, Left: false });
  const asset = TOOL_ASSETS[tool];

  useFrame(() => {
    const instrument = body.current;
    if (!instrument) return;
    for (const side of ["Right", "Left"] as const) {
      const hand = handWorld[side];
      const pinchStarted = hand.live && hand.pinch && !wasPinch.current[side];
      wasPinch.current[side] = hand.live && hand.pinch;

      if (holder.current === null && pinchStarted) {
        toolAt.copy(instrument.translation() as THREE.Vector3);
        if (hand.pinchPoint.distanceTo(toolAt) < GRAB_RADIUS) {
          holder.current = side;
          instrument.setBodyType(KINEMATIC_POSITION, true);
        }
      }
      if (holder.current !== side) continue;

      if (!hand.live || !hand.pinch) { // released: fall out of the hand with its momentum
        holder.current = null;
        instrument.setBodyType(DYNAMIC, true);
        instrument.setLinvel(hand.velocity, true);
        instrument.setAngvel({ x: 0, y: 0, z: 0 }, true);
      } else {
        instrument.setNextKinematicTranslation(hand.pinchPoint);
        targetRot.copy(hand.quaternion).multiply(gripOffset);
        instrument.setNextKinematicRotation(targetRot);
      }
    }
  });

  return <RigidBody ref={body} position={TRAY_SPAWN} colliders={false} ccd linearDamping={.2} angularDamping={.6}>
    <CuboidCollider args={[.07, .05, .38]} friction={.8} restitution={.05} />
    <SafeMedicalGLB path={asset.path} targetSize={.75} color="#bdc8cc" metalness={.84} roughness={.2} preserveTextures={false} rotation={asset.rotation} fallback={<group />} />
  </RigidBody>;
}
