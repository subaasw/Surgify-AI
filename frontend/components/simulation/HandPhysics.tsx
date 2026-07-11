"use client";

import { Suspense, useMemo, useRef, type ReactNode } from "react";
import { Physics, RigidBody, CuboidCollider, BallCollider, RapierRigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SafeMedicalGLB } from "./ModelRegistry";
import { MODEL_PATHS } from "@/data/modelConfig";
import { handWorld, interactionState, type Side } from "./GestureHandControl";

export const TOOL_ASSETS: Record<string, { path: string; rotation: [number, number, number] }> = {
  "Needle holder": { path: MODEL_PATHS.needleHolder, rotation: [Math.PI / 2, 0, 0] },
  Forceps: { path: MODEL_PATHS.forceps, rotation: [Math.PI / 2, 0, 0] },
  "Surgical scissors": { path: MODEL_PATHS.scissors, rotation: [0, 0, Math.PI / 2] },
  "Curved needle": { path: MODEL_PATHS.curvedNeedle, rotation: [Math.PI / 2, 0, 0] },
};

const TRAY_SPAWN: [number, number, number] = [2.8, 1.18, -.62];
const GRAB_RADIUS = .62; // pinch point must be this close (world units) to pick a body up
const PARKED = { x: 0, y: -20, z: 0 }; // kinematic hand bodies wait here while untracked

// Rapier body-type enum values (RigidBodyType from @dimforge/rapier3d-compat)
const DYNAMIC = 0;
const KINEMATIC_POSITION = 2;

const targetRot = new THREE.Quaternion();
const objAt = new THREE.Vector3();
const releaseVel = new THREE.Vector3();
const RELEASE_SPEED_CAP = 2.6; // m/s — stops flung objects rocketing across the room

export function SurgicalPhysics({ selectedTool, active }: { selectedTool: string | null; active: boolean }) {
  if (!active) return null;
  return <Suspense fallback={null}>
    <Physics colliders={false} timeStep="vary">
      <CuboidCollider args={[.68, .03, .38]} position={[2.8, 1.05, -.62]} friction={.9} />
      <CuboidCollider args={[1.15, .28, 2.4]} position={[0, 1.45, 0]} friction={.9} />
      <CuboidCollider args={[7, .05, 6]} position={[0, -.05, 0]} />
      {/* invisible room walls + ceiling so grabbed/dropped objects can't leave the scene */}
      <CuboidCollider args={[.2, 3, 4]} position={[-3.5, 2.5, 0]} />
      <CuboidCollider args={[.2, 3, 4]} position={[3.5, 2.5, 0]} />
      <CuboidCollider args={[3.6, 3, .2]} position={[0, 2.5, -3.9]} />
      <CuboidCollider args={[3.6, 3, .2]} position={[0, 2.5, 3.9]} />
      <CuboidCollider args={[3.6, .2, 4]} position={[0, 4.6, 0]} />
      <PinchBody side="Right" />
      <PinchBody side="Left" />
      {selectedTool && TOOL_ASSETS[selectedTool] && <PhysicalInstrument key={selectedTool} tool={selectedTool} />}
      <SurgicalEquipment />
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


function Grabbable({ spawn, gravity = true, grabRadius = GRAB_RADIUS, gripEuler, children }: {
  spawn: [number, number, number];
  gravity?: boolean;
  grabRadius?: number;
  gripEuler?: [number, number, number];
  children: ReactNode;
}) {
  const body = useRef<RapierRigidBody>(null);
  const holder = useRef<Side | null>(null);
  const wasPinch = useRef<Record<Side, boolean>>({ Right: false, Left: false });
  const grip = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(...(gripEuler ?? [Math.PI / 2, 0, 0]))), [gripEuler]);

  useFrame(() => {
    const b = body.current;
    if (!b) return;
    for (const side of ["Right", "Left"] as const) {
      const hand = handWorld[side];
      const pinchNow = hand.live && hand.pinch;
      const pinchStarted = pinchNow && !wasPinch.current[side];
      wasPinch.current[side] = pinchNow;

      // While the wheel is open a pinch means "select", so don't also grab.
      if (holder.current === null && pinchStarted && !hand.holding && !interactionState.menuOpen) {
        objAt.copy(b.translation() as THREE.Vector3);
        if (hand.pinchPoint.distanceTo(objAt) < grabRadius) {
          holder.current = side;
          hand.holding = true;
          b.setBodyType(KINEMATIC_POSITION, true);
        }
      }
      if (holder.current !== side) continue;

      if (!pinchNow) { // released: drift out of the hand, momentum capped so it can't fly off
        holder.current = null;
        hand.holding = false;
        b.setBodyType(DYNAMIC, true);
        releaseVel.copy(hand.velocity);
        if (releaseVel.length() > RELEASE_SPEED_CAP) releaseVel.setLength(RELEASE_SPEED_CAP);
        b.setLinvel(releaseVel, true);
        b.setAngvel({ x: 0, y: 0, z: 0 }, true);
      } else {
        b.setNextKinematicTranslation(hand.pinchPoint);
        targetRot.copy(hand.quaternion).multiply(grip);
        b.setNextKinematicRotation(targetRot);
      }
    }
  });

  return <RigidBody ref={body} position={spawn} colliders={false} ccd linearDamping={.4} angularDamping={.7} gravityScale={gravity ? 1 : 0}>
    {children}
  </RigidBody>;
}

function PhysicalInstrument({ tool }: { tool: string }) {
  const asset = TOOL_ASSETS[tool];
  return <Grabbable spawn={TRAY_SPAWN} gripEuler={[Math.PI / 2, 0, 0]}>
    <CuboidCollider args={[.07, .05, .38]} friction={.8} restitution={.05} />
    <SafeMedicalGLB path={asset.path} targetSize={.75} color="#bdc8cc" metalness={.84} roughness={.2} preserveTextures={false} rotation={asset.rotation} fallback={<group />} />
  </Grabbable>;
}

/** Loose grabbable equipment on/around the tray, plus a floating anatomy specimen to pick up and rotate. */
function SurgicalEquipment() {
  return <>
    {/* gauze squares */}
    <Grabbable spawn={[2.52, 1.22, -.48]} grabRadius={.5}>
      <CuboidCollider args={[.09, .03, .09]} friction={.95} />
      <mesh castShadow><boxGeometry args={[.18, .06, .18]} /><meshStandardMaterial color="#eef2ee" roughness={1} /></mesh>
    </Grabbable>
    <Grabbable spawn={[2.96, 1.22, -.78]} grabRadius={.5}>
      <CuboidCollider args={[.09, .03, .09]} friction={.95} />
      <mesh castShadow><boxGeometry args={[.18, .06, .18]} /><meshStandardMaterial color="#e4ece8" roughness={1} /></mesh>
    </Grabbable>
    {/* kidney dish */}
    <Grabbable spawn={[3.08, 1.28, -.44]} grabRadius={.58}>
      <CuboidCollider args={[.22, .05, .15]} friction={.6} />
      <mesh castShadow><cylinderGeometry args={[.24, .17, .1, 22]} /><meshStandardMaterial color="#c2ccce" metalness={.72} roughness={.28} /></mesh>
    </Grabbable>
    {/* clamp */}
    <Grabbable spawn={[2.66, 1.24, -.82]} grabRadius={.5}>
      <CuboidCollider args={[.04, .03, .22]} friction={.8} />
      <mesh castShadow><boxGeometry args={[.06, .05, .42]} /><meshStandardMaterial color="#c8d0d2" metalness={.85} roughness={.2} /></mesh>
    </Grabbable>
  </>;
}
