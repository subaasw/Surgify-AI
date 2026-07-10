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

type Side = "Left" | "Right";

/** Latest backend detections, written by the driver and read at render rate by useFrame. */
export const handStore: { hands: TrackedHand[]; at: number; gripSide: Side | null } = { hands: [], at: 0, gripSide: null };

const API_URL = process.env.NEXT_PUBLIC_SURGIFY_API_URL ?? "http://localhost:8000/api/v1";
const FRAME_INTERVAL_MS = 160;
const RELEASE_FRAMES = 4; // sustained open palms before the tool returns to the tray
const STALE_MS = 1200; // no detection for this long → hand parks by the tray

// Calibration knobs for the rigged arms asset.
const HAND_LENGTH = .56; // wrist → middle fingertip, world units
const ARM_SHORTEN = { upper: .35, fore: .55 }; // compress the arm trailing behind the wrist
const CURL_PER_JOINT = [.8, 1.05, .65]; // radians per knuckle at full curl
const FLIP_HANDEDNESS = false; // flip if the on-screen hands mirror your real ones
const PARK: Record<Side, { x: number; y: number; z: number }> = {
  Right: { x: 2.3, y: 2.35, z: 1.5 },
  Left: { x: -2.3, y: 2.35, z: 1.5 },
};

const sideOfHand = (hand: TrackedHand): Side => (hand.handedness === "Left") !== FLIP_HANDEDNESS ? "Left" : "Right";

const HAND_CONNECTIONS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]] as const;
const SIDE_COLORS: Record<Side, string> = { Right: "#5fd4de", Left: "#f0c25e" };

type TrackingPhase = "starting" | "denied" | "offline" | "active";

/**
 * DOM side of gesture control: streams webcam frames to the backend MediaPipe
 * endpoint, publishes every detected hand into `handStore`, and shows a
 * picture-in-picture camera panel with the detected skeletons and gestures
 * drawn live over the video. Render it outside the r3f Canvas.
 */
export function HandTrackingDriver() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<TrackingPhase>("starting");
  const [gesture, setGesture] = useState("No hands");
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

    const drawOverlay = (hands: TrackedHand[]) => {
      const overlay = overlayRef.current;
      const context = overlay?.getContext("2d");
      if (!overlay || !context) return;
      context.clearRect(0, 0, overlay.width, overlay.height);
      for (const hand of hands) {
        const color = SIDE_COLORS[sideOfHand(hand)];
        const px = (i: number) => (1 - hand.landmarks[i].x) * overlay.width; // mirror to match the selfie video
        const py = (i: number) => hand.landmarks[i].y * overlay.height;
        context.strokeStyle = color;
        context.lineWidth = 1.4;
        context.beginPath();
        for (const [a, b] of HAND_CONNECTIONS) { context.moveTo(px(a), py(a)); context.lineTo(px(b), py(b)); }
        context.stroke();
        context.fillStyle = color;
        for (let i = 0; i < hand.landmarks.length; i++) { context.beginPath(); context.arc(px(i), py(i), 1.7, 0, Math.PI * 2); context.fill(); }
        if (hand.pinch) { context.strokeStyle = "#63e08d"; context.lineWidth = 2; context.beginPath(); context.arc((px(4) + px(8)) / 2, (py(4) + py(8)) / 2, 7, 0, Math.PI * 2); context.stroke(); }
        context.font = "600 9px system-ui";
        context.fillStyle = "#eafcff";
        const label = `${hand.handedness} · ${hand.pinch ? "Pinch" : hand.gesture?.replace(/_/g, " ") || "Hand"}`;
        context.fillText(label, Math.min(px(0), overlay.width - context.measureText(label).width - 3), Math.min(py(0) + 12, overlay.height - 4));
      }
    };

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
        const hands = (result.hands ?? []).slice(0, 2);
        handStore.hands = hands;
        handStore.at = performance.now();
        const pinching = hands.find(hand => hand.pinch);
        handStore.gripSide = pinching ? sideOfHand(pinching) : null;
        setPhase("active");
        setGesture(hands.length
          ? hands.map(hand => `${hand.handedness[0]}·${hand.pinch ? "Pinch" : hand.gesture?.replace(/_/g, " ") || "Hand"}`).join("  ")
          : "No hands");
        drawOverlay(hands);
        openFrames = hands.length && hands.every(hand => hand.gesture === "Open_Palm" && !hand.pinch) ? openFrames + 1 : 0;
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
      handStore.hands = [];
      handStore.gripSide = null;
    };
  }, []);

  const label = phase === "starting" ? "Starting camera…" : phase === "denied" ? "Camera blocked" : phase === "offline" ? "Vision offline — start backend :8000" : "Hand tracking";
  return <div className={`gesture-pip${phase === "active" ? "" : " offline"}`}>
    <div className="gesture-pip-feed">
      <video ref={videoRef} muted playsInline />
      <canvas ref={overlayRef} width={204} height={153} />
    </div>
    <div><i /><span>{label}</span>{phase === "active" && <strong>{gesture}</strong>}</div>
  </div>;
}

const TOOL_ASSETS: Record<string, string> = {
  "Needle holder": MODEL_PATHS.needleHolder,
  Forceps: MODEL_PATHS.forceps,
  "Surgical scissors": MODEL_PATHS.scissors,
  "Curved needle": MODEL_PATHS.curvedNeedle,
};

const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Pinky"] as const;
type FingerName = "thumb" | "index" | "middle" | "ring" | "pinky";
const RELAXED_CURLS: Record<FingerName, number> = { thumb: .15, index: .15, middle: .15, ring: .15, pinky: .15 };

type Joint = { bone: THREE.Object3D; rest: THREE.Quaternion; axis: THREE.Vector3 };

const vecOf = (root: THREE.Object3D, name: string) => {
  const bone = root.getObjectByName(name);
  return bone ? bone.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
};

const basisQuat = (across: THREE.Vector3, up: THREE.Vector3, forward: THREE.Vector3) =>
  new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, up, forward));

/** Both surgeon hands, each independently driven by its detected counterpart. */
export function GestureHand() {
  return <>
    <ModelErrorBoundary fallback={<group />}><Suspense fallback={<group />}><RiggedHand side="Right" /></Suspense></ModelErrorBoundary>
    <ModelErrorBoundary fallback={<group />}><Suspense fallback={<group />}><RiggedHand side="Left" /></Suspense></ModelErrorBoundary>
  </>;
}

/**
 * One surgeon hand: MediaPipe landmarks drive the FBX skeleton directly.
 * Palm orientation comes from the landmark basis (so showing the back of the
 * hand or the palm reads correctly), each finger curls from its own landmark
 * angles, and position is spring-damped with a collision floor above the
 * patient. Parks at the bedside while its hand is not detected.
 */
function RiggedHand({ side }: { side: Side }) {
  const source = useLoader(FBXLoader, MODEL_PATHS.handArm);
  const root = useRef<THREE.Group>(null);
  const rot = useRef<THREE.Group>(null);
  const park = PARK[side];
  const axes = useRef({
    x: { value: park.x, velocity: 0 },
    y: { value: park.y, velocity: 0 },
    z: { value: park.z, velocity: 0 },
    grip: { value: 0, velocity: 0 },
  });
  const curls = useRef<Record<FingerName, number>>({ ...RELAXED_CURLS });
  const { state } = useSimulation();
  const toolPath = state.selectedTool ? TOOL_ASSETS[state.selectedTool] : undefined;

  const { rig, wrist, pivot, restQuatInv, fingers } = useMemo(() => {
    const rig = cloneSkeleton(source);
    const glove = new THREE.MeshStandardMaterial({ color: "#9fc6d8", roughness: .5, metalness: .05 });
    rig.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.frustumCulled = false; // skinned bounds don't follow the moving root
      object.material = Array.isArray(object.material) ? object.material.map(() => glove) : glove;
    });
    const other: Side = side === "Left" ? "Right" : "Left";
    rig.getObjectByName(`${other}Shoulder`)?.scale.setScalar(.0001); // this instance renders one hand only
    // compress the arm trailing behind the wrist, keeping the hand full size
    rig.getObjectByName(`${side}Arm`)?.scale.setScalar(ARM_SHORTEN.upper);
    rig.getObjectByName(`${side}ForeArm_`)?.scale.setScalar(ARM_SHORTEN.fore);
    rig.getObjectByName(`${side}Hand`)?.scale.setScalar(1 / (ARM_SHORTEN.upper * ARM_SHORTEN.fore));
    rig.updateMatrixWorld(true);
    const wrist = rig.getObjectByName(`${side}Hand`) ?? rig;
    const handSpan = vecOf(rig, `${side}Hand`).distanceTo(vecOf(rig, `${side}HandMiddle4`)) || 1;
    rig.scale.setScalar(HAND_LENGTH / handSpan);
    rig.updateMatrixWorld(true);

    const wristAt = wrist.getWorldPosition(new THREE.Vector3());
    // anatomical rest basis of this hand, from its own knuckle bones
    const forward = vecOf(rig, `${side}HandMiddle1`).sub(wristAt).normalize();
    const up = new THREE.Vector3().crossVectors(forward, vecOf(rig, `${side}HandIndex1`).sub(vecOf(rig, `${side}HandPinky1`)).normalize()).normalize();
    const across = new THREE.Vector3().crossVectors(up, forward).normalize();
    const fingers = {} as Record<FingerName, Joint[]>;
    for (const finger of FINGERS) {
      const joints: Joint[] = [];
      for (let j = 1; j <= 3; j++) {
        const bone = rig.getObjectByName(`${side}Hand${finger}${j}`);
        if (!bone) continue;
        const worldQuat = bone.getWorldQuaternion(new THREE.Quaternion());
        joints.push({ bone, rest: bone.quaternion.clone(), axis: across.clone().applyQuaternion(worldQuat.invert()).normalize() });
      }
      fingers[finger.toLowerCase() as FingerName] = joints;
    }
    return { rig, wrist, pivot: wristAt.negate(), restQuatInv: basisQuat(across, up, forward).invert(), fingers };
  }, [source, side]);

  useFrame((_, delta) => {
    const group = root.current;
    const rotGroup = rot.current;
    if (!group || !rotGroup) return;
    const fresh = performance.now() - handStore.at < STALE_MS;
    const live = fresh ? handStore.hands.find(hand => sideOfHand(hand) === side) ?? null : null;

    rig.position.copy(pivot);
    const pose = live ? palmPose(live) : { ...park, grip: 0, axes: null };
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
      ).multiply(restQuatInv);
      rotGroup.quaternion.slerp(target, damp(14, delta));
    }

    const liveCurls = (live ? fingerCurls(live.landmarks) : RELAXED_CURLS) as Record<FingerName, number>;
    const blend = damp(16, delta);
    for (const finger of Object.keys(curls.current) as FingerName[]) {
      const level = curls.current[finger] += (liveCurls[finger] - curls.current[finger]) * blend;
      for (let j = 0; j < 3; j++) {
        const joint = fingers[finger]?.[j];
        if (joint) joint.bone.quaternion.copy(joint.rest).multiply(new THREE.Quaternion().setFromAxisAngle(joint.axis, level * CURL_PER_JOINT[j]));
      }
    }
  });

  return <group ref={root} position={[park.x, park.y, park.z]}>
    <group ref={rot}>
      <primitive object={rig} />
    </group>
    {toolPath && createPortal(
      <GrippedTool path={toolPath} side={side} axesRef={axes} />,
      wrist,
    )}
  </group>;
}

type AxesRef = React.RefObject<{ grip: { value: number } }>;

/** Instrument held in the palm — visible only while this hand is the one pinching. */
function GrippedTool({ path, side, axesRef }: { path: string; side: Side; axesRef: AxesRef }) {
  const holder = useRef<THREE.Group>(null);
  useFrame(() => {
    if (holder.current) holder.current.visible = handStore.gripSide === side && (axesRef.current?.grip.value ?? 0) > .5;
  });
  return <group ref={holder} visible={false}>
    <SafeMedicalGLB path={path} targetSize={22} color="#bcc8cc" metalness={.84} roughness={.2} preserveTextures={false} position={[0, 0, 6]} rotation={[Math.PI / 2, 0, 0]} fallback={<group />} />
  </group>;
}
