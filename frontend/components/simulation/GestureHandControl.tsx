"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { useSimulation } from "./SimulationProvider";
import { ModelErrorBoundary, SafeMedicalGLB } from "./ModelRegistry";
import { MODEL_PATHS } from "@/data/modelConfig";
import { WORKSPACE, damp, fingerCurls, palmPose, springStep } from "@/lib/handPhysics.mjs";

type Landmark = { x: number; y: number; z: number };
export type TrackedHand = {
  handedness: string;
  gesture: string;
  pinch: boolean;
  pointer: { x: number; y: number };
  landmarks: Landmark[];
};

/** Latest backend detection, written by the driver and read at render rate by useFrame. */
export const handStore: { hand: TrackedHand | null; at: number } = { hand: null, at: 0 };

const API_URL = process.env.NEXT_PUBLIC_SURGIFY_API_URL ?? "http://localhost:8000/api/v1";
const FRAME_INTERVAL_MS = 180;
const RELEASE_FRAMES = 4; // sustained open palms before the tool returns to the tray
const STALE_MS = 1200; // no detection for this long → hand parks by the tray

// Calibration knobs for the rigged arms asset.
const HAND_LENGTH = .56; // wrist → middle fingertip, world units
const ARM_SHORTEN = { upper: .35, fore: .55 }; // compress the arm trailing behind the wrist
const CURL_PER_JOINT = [.8, 1.05, .65]; // radians per knuckle at full curl
const FLIP_HANDEDNESS = false; // flip if the on-screen hand mirrors your real one
const PARK = { x: 2.4, y: 2.4, z: 1.4 };

type TrackingPhase = "starting" | "denied" | "offline" | "active";

/**
 * DOM side of gesture control: streams webcam frames to the backend MediaPipe
 * endpoint, publishes the first detected hand into `handStore`, and shows a
 * small picture-in-picture camera panel. Render it outside the r3f Canvas.
 */
export function HandTrackingDriver() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<TrackingPhase>("starting");
  const [gesture, setGesture] = useState("No hand");
  const { state, releaseTool } = useSimulation();
  const simRef = useRef({ selectedTool: state.selectedTool, releaseTool });
  useEffect(() => { simRef.current = { selectedTool: state.selectedTool, releaseTool }; }, [state.selectedTool, releaseTool]);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    let inFlight = false;
    let openFrames = 0;
    const canvas = document.createElement("canvas");

    const tick = async () => {
      const video = videoRef.current;
      if (stopped || !video || video.readyState < 2 || !video.videoWidth || inFlight) return;
      inFlight = true;
      try {
        canvas.width = 384;
        canvas.height = Math.round(384 * video.videoHeight / video.videoWidth);
        canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", .72));
        if (!blob) return;
        const form = new FormData();
        form.append("frame", blob, "camera-frame.jpg");
        form.append("mode", "mediapipe");
        form.append("timestamp_ms", String(Date.now()));
        const response = await fetch(`${API_URL}/vision/frame`, { method: "POST", body: form });
        if (!response.ok || stopped) { setPhase("offline"); return; }
        const result = await response.json() as { hands?: TrackedHand[] };
        const hand = result.hands?.[0] ?? null;
        handStore.hand = hand;
        handStore.at = performance.now();
        setPhase("active");
        setGesture(hand ? (hand.pinch ? "Pinch" : hand.gesture?.replace(/_/g, " ") || "Tracking") : "No hand");
        openFrames = hand && hand.gesture === "Open_Palm" && !hand.pinch ? openFrames + 1 : 0;
        if (openFrames === RELEASE_FRAMES && simRef.current.selectedTool) simRef.current.releaseTool();
      } catch {
        if (!stopped) setPhase("offline");
      } finally {
        inFlight = false;
      }
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        timer = window.setInterval(tick, FRAME_INTERVAL_MS);
      } catch {
        if (!stopped) setPhase("denied");
      }
    })();

    return () => {
      stopped = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach(track => track.stop());
      handStore.hand = null;
    };
  }, []);

  const label = phase === "starting" ? "Starting camera…" : phase === "denied" ? "Camera blocked" : phase === "offline" ? "Vision offline — start backend :8000" : "Hand tracking";
  return <div className={`gesture-pip${phase === "active" ? "" : " offline"}`}>
    <video ref={videoRef} muted playsInline />
    <div><i /><span>{label}</span>{phase === "active" && <strong>{gesture}</strong>}</div>
  </div>;
}

const TOOL_ASSETS: Record<string, string> = {
  "Needle holder": MODEL_PATHS.needleHolder,
  Forceps: MODEL_PATHS.forceps,
  "Surgical scissors": MODEL_PATHS.scissors,
  "Curved needle": MODEL_PATHS.curvedNeedle,
};

type Side = "Left" | "Right";
const SIDES: Side[] = ["Left", "Right"];
const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Pinky"] as const;
type FingerName = "thumb" | "index" | "middle" | "ring" | "pinky";

type Joint = { bone: THREE.Object3D; rest: THREE.Quaternion; axis: THREE.Vector3 };
type SideRig = {
  armRoot: THREE.Object3D | null;
  armBaseScale: number;
  wrist: THREE.Object3D;
  pivot: THREE.Vector3; // rig offset that puts this wrist at the group origin
  restQuatInv: THREE.Quaternion;
  fingers: Record<FingerName, Joint[]>;
};

const vecOf = (root: THREE.Object3D, name: string) => {
  const bone = root.getObjectByName(name);
  return bone ? bone.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
};

const basisQuat = (across: THREE.Vector3, up: THREE.Vector3, forward: THREE.Vector3) =>
  new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, up, forward));

/** Wraps the rigged hand in error/suspense boundaries so a bad asset degrades gracefully. */
export function GestureHand() {
  return <ModelErrorBoundary fallback={<group />}>
    <Suspense fallback={<group />}>
      <RiggedHand />
    </Suspense>
  </ModelErrorBoundary>;
}

/**
 * The surgeon hand: MediaPipe landmarks drive the FBX skeleton directly.
 * Palm orientation comes from the landmark basis (so showing the back of the
 * hand or the palm reads correctly), each finger curls from its own landmark
 * angles, the arm matching the detected handedness is shown, and position is
 * spring-damped with a collision floor above the patient.
 */
function RiggedHand() {
  const source = useLoader(FBXLoader, MODEL_PATHS.handArm);
  const root = useRef<THREE.Group>(null);
  const rot = useRef<THREE.Group>(null);
  const [side, setSide] = useState<Side>("Right");
  const axes = useRef({
    x: { value: PARK.x, velocity: 0 },
    y: { value: PARK.y, velocity: 0 },
    z: { value: PARK.z, velocity: 0 },
    grip: { value: 0, velocity: 0 },
  });
  const curls = useRef<Record<FingerName, number>>({ thumb: .15, index: .15, middle: .15, ring: .15, pinky: .15 });
  const { state } = useSimulation();
  const toolPath = state.selectedTool ? TOOL_ASSETS[state.selectedTool] : undefined;

  const { rig, sides } = useMemo(() => {
    const rig = cloneSkeleton(source);
    const glove = new THREE.MeshStandardMaterial({ color: "#9fc6d8", roughness: .5, metalness: .05 });
    rig.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.frustumCulled = false; // skinned bounds don't follow the moving root
      object.material = Array.isArray(object.material) ? object.material.map(() => glove) : glove;
    });
    for (const s of SIDES) {
      // compress the arm trailing behind the wrist, keeping the hand full size
      rig.getObjectByName(`${s}Arm`)?.scale.setScalar(ARM_SHORTEN.upper);
      rig.getObjectByName(`${s}ForeArm_`)?.scale.setScalar(ARM_SHORTEN.fore);
      rig.getObjectByName(`${s}Hand`)?.scale.setScalar(1 / (ARM_SHORTEN.upper * ARM_SHORTEN.fore));
    }
    rig.updateMatrixWorld(true);
    const handSpan = vecOf(rig, "LeftHand").distanceTo(vecOf(rig, "LeftHandMiddle4")) || 1;
    rig.scale.setScalar(HAND_LENGTH / handSpan);
    rig.updateMatrixWorld(true);

    const sides = {} as Record<Side, SideRig>;
    for (const s of SIDES) {
      const wrist = rig.getObjectByName(`${s}Hand`);
      // collapse from the shoulder so no orphaned shoulder chunk floats around
      const armRoot = rig.getObjectByName(`${s}Shoulder`) ?? rig.getObjectByName(`${s}Arm`) ?? null;
      if (!wrist) continue;
      const wristAt = wrist.getWorldPosition(new THREE.Vector3());
      // anatomical rest basis of this hand, from its own knuckle bones
      const forward = vecOf(rig, `${s}HandMiddle1`).sub(wristAt).normalize();
      const up = new THREE.Vector3().crossVectors(forward, vecOf(rig, `${s}HandIndex1`).sub(vecOf(rig, `${s}HandPinky1`)).normalize()).normalize();
      const across = new THREE.Vector3().crossVectors(up, forward).normalize();
      const fingers = {} as Record<FingerName, Joint[]>;
      for (const finger of FINGERS) {
        const joints: Joint[] = [];
        for (let j = 1; j <= 3; j++) {
          const bone = rig.getObjectByName(`${s}Hand${finger}${j}`);
          if (!bone) continue;
          const worldQuat = bone.getWorldQuaternion(new THREE.Quaternion());
          joints.push({ bone, rest: bone.quaternion.clone(), axis: across.clone().applyQuaternion(worldQuat.invert()).normalize() });
        }
        fingers[finger.toLowerCase() as FingerName] = joints;
      }
      sides[s] = {
        wrist,
        armRoot,
        armBaseScale: armRoot?.scale.x ?? 1,
        pivot: wristAt.negate(),
        restQuatInv: basisQuat(across, up, forward).invert(),
        fingers,
      };
    }
    return { rig, sides };
  }, [source]);

  useFrame((_, delta) => {
    const group = root.current;
    const rotGroup = rot.current;
    if (!group || !rotGroup) return;
    const live = handStore.hand && performance.now() - handStore.at < STALE_MS ? handStore.hand : null;

    const detected: Side = (live?.handedness === "Left") !== FLIP_HANDEDNESS ? "Left" : "Right";
    const activeSide = live ? detected : side;
    if (live && detected !== side) setSide(detected);
    const rigSide = sides[activeSide] ?? sides.Right;
    if (!rigSide) return;
    for (const s of SIDES) sides[s]?.armRoot?.scale.setScalar(s === activeSide ? sides[s].armBaseScale : .0001);
    rig.position.copy(rigSide.pivot);

    const pose = live ? palmPose(live) : { ...PARK, grip: 0, axes: null };
    const a = axes.current;
    springStep(a.x, pose.x, delta);
    springStep(a.y, pose.y, delta);
    springStep(a.z, pose.z, delta);
    springStep(a.grip, pose.grip, delta, 40, 12);
    group.position.set(a.x.value, Math.max(a.y.value, WORKSPACE.floorY), a.z.value);

    if (pose.axes) {
      const target = basisQuat(
        new THREE.Vector3(...pose.axes.across),
        new THREE.Vector3(...pose.axes.up),
        new THREE.Vector3(...pose.axes.forward),
      ).multiply(rigSide.restQuatInv);
      rotGroup.quaternion.slerp(target, damp(14, delta));
    }

    const liveCurls = (live ? fingerCurls(live.landmarks) : { thumb: .15, index: .15, middle: .15, ring: .15, pinky: .15 }) as Record<FingerName, number>;
    const blend = damp(16, delta);
    for (const finger of Object.keys(curls.current) as FingerName[]) {
      const level = curls.current[finger] += (liveCurls[finger] - curls.current[finger]) * blend;
      for (let j = 0; j < 3; j++) {
        const joint = rigSide.fingers[finger]?.[j];
        if (joint) joint.bone.quaternion.copy(joint.rest).multiply(new THREE.Quaternion().setFromAxisAngle(joint.axis, level * CURL_PER_JOINT[j]));
      }
    }
  });

  const wrist = sides[side]?.wrist;
  return <group ref={root} position={[PARK.x, PARK.y, PARK.z]}>
    <group ref={rot}>
      <primitive object={rig} />
    </group>
    {toolPath && wrist && createPortal(
      <GrippedTool path={toolPath} axesRef={axes} />,
      wrist,
    )}
  </group>;
}

type AxesRef = React.RefObject<{ grip: { value: number } }>;

/** Instrument held in the palm — visible only while the hand pinches. */
function GrippedTool({ path, axesRef }: { path: string; axesRef: AxesRef }) {
  const holder = useRef<THREE.Group>(null);
  useFrame(() => { if (holder.current) holder.current.visible = (axesRef.current?.grip.value ?? 0) > .5; });
  return <group ref={holder} visible={false}>
    <SafeMedicalGLB path={path} targetSize={22} color="#bcc8cc" metalness={.84} roughness={.2} preserveTextures={false} position={[0, 0, 6]} rotation={[Math.PI / 2, 0, 0]} fallback={<group />} />
  </group>;
}
