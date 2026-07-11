"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { BallCollider, CuboidCollider, Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SafeMedicalGLB } from "./ModelRegistry";
import { useSimulation } from "./SimulationProvider";
import { MODEL_PATHS } from "@/data/modelConfig";
import { incisionSegmentAt, insideSurgeryWindow, requiredSurgeryTools, sceneSurfaceYAt } from "@/lib/handPhysics.mjs";
import { handWorld, interactionState, type Side } from "./GestureHandControl";

export const TOOL_ASSETS: Record<string, { path: string; rotation: [number, number, number] }> = {
  "Needle holder": { path: MODEL_PATHS.needleHolder, rotation: [Math.PI / 2, 0, 0] },
  Forceps: { path: MODEL_PATHS.forceps, rotation: [Math.PI / 2, 0, 0] },
  "Surgical scissors": { path: MODEL_PATHS.scissors, rotation: [0, 0, Math.PI / 2] },
  "Curved needle": { path: MODEL_PATHS.curvedNeedle, rotation: [Math.PI / 2, 0, 0] },
};

type PhysicalTool = "Scalpel" | "Forceps" | "Needle holder" | "Surgical scissors";
type ToolPose = { live: boolean; holder: Side | null; position: THREE.Vector3; quaternion: THREE.Quaternion; tip: THREE.Vector3 };
const emptyTool = (): ToolPose => ({ live: false, holder: null, position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), tip: new THREE.Vector3() });
export const toolWorld: Record<PhysicalTool, ToolPose> = {
  Scalpel: emptyTool(), Forceps: emptyTool(), "Needle holder": emptyTool(), "Surgical scissors": emptyTool(),
};

export const surgerySite = {
  ready: false,
  matrixWorld: new THREE.Matrix4(),
  inverse: new THREE.Matrix4(),
  normal: new THREE.Vector3(0, 1, 0),
};

const TOOL_CONFIG: Record<PhysicalTool, {
  spawn: [number, number, number];
  tip: [number, number, number];
  grip: [number, number, number];
  rotation: [number, number, number];
  size: number;
}> = {
  Scalpel: { spawn: [2.34, 1.18, -.62], tip: [0, 0, -.38], grip: [0, 0, .11], rotation: [0, 0, 0], size: .58 },
  Forceps: { spawn: [2.66, 1.18, -.62], tip: [0, 0, -.34], grip: [0, 0, .1], rotation: TOOL_ASSETS.Forceps.rotation, size: .62 },
  "Needle holder": { spawn: [2.98, 1.18, -.62], tip: [0, 0, -.35], grip: [0, 0, .1], rotation: TOOL_ASSETS["Needle holder"].rotation, size: .66 },
  "Surgical scissors": { spawn: [3.3, 1.18, -.62], tip: [0, 0, -.3], grip: [0, 0, .08], rotation: TOOL_ASSETS["Surgical scissors"].rotation, size: .62 },
};

const PARKED = { x: 0, y: -20, z: 0 };
const DYNAMIC = 0;
const KINEMATIC_POSITION = 2;
const targetPosition = new THREE.Vector3();
const targetRotation = new THREE.Quaternion();
const gripOffset = new THREE.Vector3();
const tipOffset = new THREE.Vector3();
const bodyPosition = new THREE.Vector3();
const localTip = new THREE.Vector3();
const localNeedle = new THREE.Vector3();
const localForceps = new THREE.Vector3();
const toolAxis = new THREE.Vector3();
const surfaceNormal = new THREE.Vector3();

export function SurgicalPhysics({ active }: { active: boolean }) {
  if (!active) return null;
  return <Suspense fallback={null}>
    <DirectSurgeryController />
    <Physics colliders={false} timeStep="vary">
      <CuboidCollider args={[.68, .03, .38]} position={[2.8, 1.05, -.62]} friction={.9} />
      <CuboidCollider args={[1.15, .28, 2.4]} position={[0, 1.45, 0]} friction={.9} />
      <PatientColliders />
      <CuboidCollider args={[7, .05, 6]} position={[0, -.05, 0]} />
      <CuboidCollider args={[.2, 3, 4]} position={[-3.5, 2.5, 0]} />
      <CuboidCollider args={[.2, 3, 4]} position={[3.5, 2.5, 0]} />
      <CuboidCollider args={[3.6, 3, .2]} position={[0, 2.5, -3.9]} />
      <CuboidCollider args={[3.6, 3, .2]} position={[0, 2.5, 3.9]} />
      <CuboidCollider args={[3.6, .2, 4]} position={[0, 4.6, 0]} />
      <PinchBody side="Right" />
      <PinchBody side="Left" />
      {(Object.keys(TOOL_CONFIG) as PhysicalTool[]).map(tool => <PhysicalInstrument key={tool} tool={tool} />)}
    </Physics>
  </Suspense>;
}

function PatientColliders() {
  return <>
    <CuboidCollider args={[.34, .175, .38]} position={[0, 1.905, -1.72]} friction={.9} />
    <CuboidCollider args={[.46, .145, .78]} position={[0, 1.875, -.56]} friction={.9} />
    <CuboidCollider args={[.18, .125, .84]} position={[-.62, 1.855, -.06]} friction={.9} />
    <CuboidCollider args={[.18, .125, .84]} position={[.62, 1.855, -.06]} friction={.9} />
    <CuboidCollider args={[.38, .105, .25]} position={[0, 1.835, .47]} friction={.9} />
    <CuboidCollider args={[.2, .065, .67]} position={[-.24, 1.795, 1.39]} friction={.9} />
    <CuboidCollider args={[.2, .065, .67]} position={[.24, 1.795, 1.39]} friction={.9} />
  </>;
}

function PinchBody({ side }: { side: Side }) {
  const body = useRef<RapierRigidBody>(null);
  useFrame(() => {
    const hand = handWorld[side];
    body.current?.setNextKinematicTranslation(hand.live && hand.pinch ? hand.pinchPoint : PARKED);
  });
  return <RigidBody ref={body} type="kinematicPosition" position={[PARKED.x, PARKED.y, PARKED.z]} colliders={false}>
    <BallCollider args={[.055]} friction={1} />
  </RigidBody>;
}

function PhysicalInstrument({ tool }: { tool: PhysicalTool }) {
  const { state, grabTool, releaseHeldTool } = useSimulation();
  const body = useRef<RapierRigidBody>(null);
  const holder = useRef<Side | null>(null);
  const wasPinch = useRef<Record<Side, boolean>>({ Right: false, Left: false });
  const config = TOOL_CONFIG[tool];
  const gripRotation = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), []);

  const returnToTray = (side: Side, rigid: RapierRigidBody) => {
    holder.current = null;
    handWorld[side].holding = false;
    releaseHeldTool(side);
    rigid.setBodyType(DYNAMIC, true);
    rigid.setTranslation({ x: config.spawn[0], y: config.spawn[1], z: config.spawn[2] }, true);
    rigid.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    rigid.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rigid.setAngvel({ x: 0, y: 0, z: 0 }, true);
  };

  useEffect(() => () => {
    const side = holder.current;
    if (side) { handWorld[side].holding = false; releaseHeldTool(side); }
    toolWorld[tool].live = false;
    toolWorld[tool].holder = null;
  }, [releaseHeldTool, tool]);

  useFrame(() => {
    const rigid = body.current;
    if (!rigid) return;
    const required = requiredSurgeryTools(state.currentStep, state.stitchPhase);
    if (holder.current && state.currentStep >= 5 && !required.includes(tool)) returnToTray(holder.current, rigid);
    for (const side of ["Right", "Left"] as const) {
      const hand = handWorld[side];
      const pinching = hand.live && hand.pinch;
      const pinchStarted = pinching && !wasPinch.current[side];
      wasPinch.current[side] = pinching;
      if (!holder.current && pinchStarted && !hand.holding && !interactionState.menuOpen) {
        bodyPosition.set(rigid.translation().x, rigid.translation().y, rigid.translation().z);
        const distance = hand.pinchPoint.distanceTo(bodyPosition);
        const nearest = (Object.keys(TOOL_CONFIG) as PhysicalTool[]).every(other => other === tool || !toolWorld[other].live || distance <= hand.pinchPoint.distanceTo(toolWorld[other].position) + .001);
        if (distance <= .34 && nearest) {
          holder.current = side;
          hand.holding = true;
          rigid.setBodyType(KINEMATIC_POSITION, true);
          grabTool(side, tool);
        }
      }
      if (holder.current !== side) continue;
      const operativeHold = state.currentStep >= 5 && required.includes(tool);
      if (!hand.live) continue;
      if (!pinching && !operativeHold) {
        returnToTray(side, rigid);
      } else {
        targetRotation.copy(hand.quaternion).multiply(gripRotation);
        gripOffset.set(...config.grip).applyQuaternion(targetRotation);
        targetPosition.copy(hand.pinchPoint).add(gripOffset);
        tipOffset.set(...config.tip).applyQuaternion(targetRotation);
        toolWorld[tool].tip.copy(targetPosition).add(tipOffset);
        const surface = sceneSurfaceYAt(toolWorld[tool].tip.x, toolWorld[tool].tip.z);
        localTip.copy(toolWorld[tool].tip).applyMatrix4(surgerySite.inverse);
        const mayCut = tool === "Scalpel" && state.currentStep === 5 && surgerySite.ready
          && Math.abs(localTip.x) <= .065 && Math.abs(localTip.z) <= .31;
        const minimumTipY = surface - (mayCut ? .025 : 0);
        if (toolWorld[tool].tip.y < minimumTipY) {
          const correction = minimumTipY - toolWorld[tool].tip.y;
          targetPosition.y += correction;
          hand.contactLift = Math.max(hand.contactLift, correction);
        }
        rigid.setNextKinematicTranslation(targetPosition);
        rigid.setNextKinematicRotation(targetRotation);
      }
    }
    const runtime = toolWorld[tool];
    if (holder.current) {
      runtime.position.copy(targetPosition);
      runtime.quaternion.copy(targetRotation);
      runtime.tip.copy(targetPosition).add(tipOffset.set(...config.tip).applyQuaternion(targetRotation));
    } else {
      const translation = rigid.translation();
      const rotation = rigid.rotation();
      runtime.position.set(translation.x, translation.y, translation.z);
      runtime.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      runtime.tip.copy(runtime.position).add(tipOffset.set(...config.tip).applyQuaternion(runtime.quaternion));
    }
    runtime.holder = holder.current;
    runtime.live = true;
  });

  return <RigidBody ref={body} position={config.spawn} colliders={false} ccd linearDamping={1.2} angularDamping={1.6}>
    <CuboidCollider args={[.055, .045, .27]} friction={.85} restitution={0} />
    {tool === "Scalpel" ? <ProceduralScalpel /> : <SafeMedicalGLB path={TOOL_ASSETS[tool].path} targetSize={config.size} color="#bdc8cc" metalness={.84} roughness={.2} preserveTextures={false} rotation={config.rotation} fallback={<group />} />}
  </RigidBody>;
}

function ProceduralScalpel() {
  return <group>
    <mesh position={[0, 0, -.03]}><boxGeometry args={[.065, .055, .42]} /><meshStandardMaterial color="#607d87" roughness={.42} metalness={.55} /></mesh>
    <mesh position={[0, 0, -.29]}><boxGeometry args={[.018, .045, .18]} /><meshStandardMaterial color="#e6eef0" roughness={.12} metalness={.92} /></mesh>
  </group>;
}

function DirectSurgeryController() {
  const { state, recordCutSegment, performAction, setStitchProgress, setSutureAngle, setSuturePosition, setSurfaceContact } = useSimulation();
  const lastCut = useRef(-1);
  const alignmentSide = useRef(0);
  const dwell = useRef(0);
  const passSide = useRef(0);
  const passProgress = useRef(0);
  const pullStart = useRef<THREE.Vector3 | null>(null);
  const knotSign = useRef(0);
  const knotCrossed = useRef(false);
  const latched = useRef(false);
  const lastStage = useRef("");

  const resetStage = (stage: string) => {
    if (lastStage.current === stage) return;
    lastStage.current = stage;
    lastCut.current = -1;
    alignmentSide.current = 0;
    dwell.current = 0;
    passSide.current = 0;
    passProgress.current = 0;
    pullStart.current = null;
    knotSign.current = 0;
    knotCrossed.current = false;
    latched.current = false;
  };

  useFrame((_, delta) => {
    if (!surgerySite.ready || state.runStatus !== "active" || state.paused) { setSurfaceContact(false); return; }
    const stage = `${state.currentStep}:${state.stitchPhase}`;
    resetStage(stage);
    let touching = false;

    if (state.currentStep === 5) {
      const scalpel = toolWorld.Scalpel;
      if (scalpel.holder) {
        localTip.copy(scalpel.tip).applyMatrix4(surgerySite.inverse);
        const segment = incisionSegmentAt(localTip);
        const depth = THREE.MathUtils.clamp(.06 - localTip.y, 0, .025);
        if (segment >= 0 && depth > .001) {
          touching = true;
          if ((lastCut.current < 0 && segment <= 2) || (segment >= lastCut.current && segment <= lastCut.current + 2)) {
            const from = Math.max(0, lastCut.current + 1);
            for (let index = from; index <= segment; index++) recordCutSegment(index, depth);
            lastCut.current = Math.max(lastCut.current, segment);
          }
        }
      }
    } else if (state.currentStep === 6) {
      if (state.stitchPhase === 0) {
        const forceps = toolWorld.Forceps;
        if (forceps.holder) {
          localTip.copy(forceps.tip).applyMatrix4(surgerySite.inverse);
          touching = insideSurgeryWindow(localTip);
          if (touching && !alignmentSide.current && Math.abs(localTip.z) >= .04) alignmentSide.current = Math.sign(localTip.z);
          if (touching && alignmentSide.current) {
            const progress = THREE.MathUtils.clamp((.18 - Math.abs(localTip.z)) / .15, 0, 1);
            setSuturePosition(Math.round(22 + progress * 28));
            dwell.current = progress > .88 ? dwell.current + delta : 0;
            if (dwell.current > .3 && !latched.current) { latched.current = true; performAction("Align nerve ends"); }
          }
        }
      } else if (state.stitchPhase === 1) {
        const holder = toolWorld["Needle holder"];
        if (holder.holder) {
          localTip.copy(holder.tip).applyMatrix4(surgerySite.inverse);
          touching = insideSurgeryWindow(localTip);
          if (touching) {
            toolAxis.set(0, 0, -1).applyQuaternion(holder.quaternion).normalize();
            surfaceNormal.copy(surgerySite.normal).normalize();
            const angle = Math.round(THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(Math.abs(toolAxis.dot(surfaceNormal)), 0, 1))));
            setSutureAngle(angle);
            dwell.current = angle >= 45 && angle <= 60 ? dwell.current + delta : 0;
            if (dwell.current > .3 && !latched.current) { latched.current = true; performAction("Set repair angle"); }
          }
        }
      } else if (state.stitchPhase === 2) {
        const holder = toolWorld["Needle holder"];
        if (holder.holder) {
          localTip.copy(holder.tip).applyMatrix4(surgerySite.inverse);
          touching = insideSurgeryWindow(localTip);
          if (touching && !passSide.current && Math.abs(localTip.x) > .1) passSide.current = Math.sign(localTip.x);
          if (touching && passSide.current) {
            const progress = THREE.MathUtils.clamp(passSide.current < 0 ? (localTip.x + .14) / .28 : (.14 - localTip.x) / .28, 0, 1);
            passProgress.current = Math.max(passProgress.current, progress);
            setStitchProgress(passProgress.current);
            if (passProgress.current > .94 && !latched.current) { latched.current = true; performAction("Pass repair stitch"); }
          }
        }
      } else if (state.stitchPhase === 3) {
        const holder = toolWorld["Needle holder"];
        if (holder.holder) {
          pullStart.current ??= holder.tip.clone();
          const progress = THREE.MathUtils.clamp(holder.tip.distanceTo(pullStart.current) / .35, 0, 1);
          setStitchProgress(progress);
          if (progress > .95 && !latched.current) { latched.current = true; performAction("Pull microsuture"); }
        }
      } else if (state.stitchPhase === 4) {
        const holder = toolWorld["Needle holder"];
        const forceps = toolWorld.Forceps;
        if (holder.holder && forceps.holder) {
          localNeedle.copy(holder.tip).applyMatrix4(surgerySite.inverse);
          localForceps.copy(forceps.tip).applyMatrix4(surgerySite.inverse);
          const sign = Math.sign(localNeedle.x - localForceps.x);
          if (knotSign.current && sign && sign !== knotSign.current) knotCrossed.current = true;
          if (sign) knotSign.current = sign;
          const separation = Math.abs(localNeedle.x - localForceps.x);
          const progress = knotCrossed.current ? THREE.MathUtils.clamp(separation / .22, 0, 1) : Math.min(.45, separation);
          setStitchProgress(progress);
          touching = insideSurgeryWindow(localNeedle) || insideSurgeryWindow(localForceps);
          if (knotCrossed.current && separation > .18 && !latched.current) { latched.current = true; performAction("Tie repair knot"); }
        }
      } else if (state.stitchPhase === 5) {
        const scissors = toolWorld["Surgical scissors"];
        if (scissors.holder) {
          localTip.copy(scissors.tip).applyMatrix4(surgerySite.inverse);
          touching = insideSurgeryWindow(localTip) && Math.hypot(localTip.x, localTip.z) < .12;
          dwell.current = touching ? dwell.current + delta : 0;
          setStitchProgress(THREE.MathUtils.clamp(dwell.current / .3, 0, 1));
          if (dwell.current > .3 && !latched.current) { latched.current = true; performAction("Cut microsuture"); }
        }
      }
    } else if (state.currentStep === 7) {
      const handsFree = !Object.values(state.heldTools).some(Boolean);
      const approved = handsFree && Object.values(handWorld).some(hand => hand.live && hand.gesture === "Thumb_Up");
      dwell.current = approved ? dwell.current + delta : 0;
      if (dwell.current > .5 && !latched.current) { latched.current = true; performAction("Finish procedure"); }
    }
    setSurfaceContact(touching);
  });
  return null;
}
