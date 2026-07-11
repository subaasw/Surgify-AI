"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SafeMedicalGLB } from "./ModelRegistry";
import { MODEL_PATHS } from "@/data/modelConfig";
import { handWorld, type Side } from "./GestureHandControl";
import { patientSurfaceYAt } from "@/lib/handPhysics.mjs";

export const TOOL_ASSETS: Record<string, { path: string; rotation: [number, number, number] }> = {
  "Needle holder": { path: MODEL_PATHS.needleHolder, rotation: [Math.PI / 2, 0, 0] },
  Forceps: { path: MODEL_PATHS.forceps, rotation: [Math.PI / 2, 0, 0] },
  "Surgical scissors": { path: MODEL_PATHS.scissors, rotation: [0, 0, Math.PI / 2] },
  "Curved needle": { path: MODEL_PATHS.curvedNeedle, rotation: [Math.PI / 2, 0, 0] },
};

const TRAY_SPAWN = new THREE.Vector3(2.8, 1.18, -.62);
const GRAB_RADIUS = .5;
const FLOOR_Y = .08;
const gripOffset = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
const targetRotation = new THREE.Quaternion();

export function SurgicalPhysics({ selectedTool, active }: { selectedTool: string | null; active: boolean }) {
  if (!active || !selectedTool || !TOOL_ASSETS[selectedTool]) return null;
  return <PhysicalInstrument key={selectedTool} tool={selectedTool} />;
}

function PhysicalInstrument({ tool }: { tool: string }) {
  const group = useRef<THREE.Group>(null);
  const position = useRef(TRAY_SPAWN.clone());
  const velocity = useRef(new THREE.Vector3());
  const holder = useRef<Side | null>(null);
  const wasPinching = useRef<Record<Side, boolean>>({ Right: false, Left: false });
  const asset = TOOL_ASSETS[tool];

  useFrame((_, delta) => {
    const object = group.current;
    if (!object) return;
    const dt = Math.min(delta, 1 / 30);
    const started: Side[] = [];
    for (const side of ["Right", "Left"] as const) {
      const hand = handWorld[side];
      if (hand.live && hand.pinch && !wasPinching.current[side]) started.push(side);
      wasPinching.current[side] = hand.live && hand.pinch;
    }

    if (holder.current) {
      const hand = handWorld[holder.current];
      if (!hand.live || !hand.pinch) {
        holder.current = null;
        velocity.current.copy(hand.velocity);
      } else {
        position.current.copy(hand.pinchPoint);
        const surface = patientSurfaceYAt(position.current.x, position.current.z);
        if (surface !== null) position.current.y = Math.max(position.current.y, surface + .025);
        targetRotation.copy(hand.quaternion).multiply(gripOffset);
        object.quaternion.slerp(targetRotation, 1 - Math.exp(-18 * dt));
      }
    }

    if (!holder.current) {
      const grabbing = started.find(side => handWorld[side].pinchPoint.distanceTo(position.current) < GRAB_RADIUS);
      if (grabbing) {
        holder.current = grabbing;
        velocity.current.set(0, 0, 0);
      } else {
        velocity.current.y -= 4.8 * dt;
        position.current.addScaledVector(velocity.current, dt);
        let support = FLOOR_Y;
        if (position.current.x > 2.08 && position.current.x < 3.52 && Math.abs(position.current.z + .62) < .46) support = 1.1;
        const patient = patientSurfaceYAt(position.current.x, position.current.z);
        if (patient !== null) support = Math.max(support, patient + .025);
        if (position.current.y < support) {
          position.current.y = support;
          if (velocity.current.y < 0) velocity.current.y *= -.08;
          velocity.current.x *= .88;
          velocity.current.z *= .88;
        }
      }
    }
    object.position.copy(position.current);
  });

  return <group ref={group} position={TRAY_SPAWN}>
    <SafeMedicalGLB path={asset.path} targetSize={.75} color="#bdc8cc" metalness={.84} roughness={.2} preserveTextures={false} rotation={asset.rotation} fallback={<group />} />
  </group>;
}
