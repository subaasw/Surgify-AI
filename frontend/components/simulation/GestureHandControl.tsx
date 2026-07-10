"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { useSimulation } from "./SimulationProvider";
import { ModelErrorBoundary, SafeMedicalGLB } from "./ModelRegistry";
import { MODEL_PATHS } from "@/data/modelConfig";
import { WORKSPACE, angleTarget, handTarget, springStep } from "@/lib/handPhysics.mjs";

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

// Calibration knobs for the FBX asset (unknown authored axes/origin).
const HAND_MODEL_ROTATION: [number, number, number] = [-Math.PI / 2, 0, Math.PI];
const HAND_MODEL_SIZE = 1.7;
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

/**
 * 3D side: the surgeon hand model, spring-damper driven toward the latest
 * detection so motion has inertia, clamped against the patient plane.
 * Pinching picks up the selected instrument; it hides again on release.
 */
export function GestureHand() {
  const root = useRef<THREE.Group>(null);
  const toolRef = useRef<THREE.Group>(null);
  const axes = useRef({
    x: { value: PARK.x, velocity: 0 },
    y: { value: PARK.y, velocity: 0 },
    z: { value: PARK.z, velocity: 0 },
    yaw: { value: 0, velocity: 0 },
    roll: { value: 0, velocity: 0 },
    grip: { value: 0, velocity: 0 },
  });
  const { state } = useSimulation();
  const toolPath = state.selectedTool ? TOOL_ASSETS[state.selectedTool] : undefined;

  useFrame((_, delta) => {
    const group = root.current;
    if (!group) return;
    const live = handStore.hand && performance.now() - handStore.at < STALE_MS ? handStore.hand : null;
    const target = live ? handTarget(live) : { ...PARK, yaw: 0, roll: 0, grip: 0 };
    const a = axes.current;
    springStep(a.x, target.x, delta);
    springStep(a.y, target.y, delta);
    springStep(a.z, target.z, delta);
    springStep(a.yaw, angleTarget(a.yaw.value, target.yaw), delta);
    springStep(a.roll, angleTarget(a.roll.value, target.roll), delta);
    springStep(a.grip, target.grip, delta, 40, 12);
    group.position.set(a.x.value, Math.max(a.y.value, WORKSPACE.floorY), a.z.value);
    group.rotation.set(0, a.yaw.value, a.roll.value * .5);
    if (toolRef.current) toolRef.current.visible = a.grip.value > .5;
  });

  return <group ref={root} position={[PARK.x, PARK.y, PARK.z]}>
    <ModelErrorBoundary fallback={<FallbackHand />}>
      <Suspense fallback={<FallbackHand />}>
        <group rotation={HAND_MODEL_ROTATION}><HandModel /></group>
      </Suspense>
    </ModelErrorBoundary>
    <group ref={toolRef} visible={false} position={[0, -.26, .1]} rotation={[Math.PI / 2, 0, 0]}>
      {toolPath && <SafeMedicalGLB path={toolPath} targetSize={.6} color="#bcc8cc" metalness={.84} roughness={.2} preserveTextures={false} fallback={<group />} />}
    </group>
  </group>;
}

/**
 * The arm FBX is a skinned rig, so a plain `.clone(true)` (what MedicalFBX
 * does) leaves the copy bound to the source skeleton and it renders collapsed
 * at the origin. SkeletonUtils.clone rebinds bones so the rig follows this
 * component's transform.
 */
function HandModel() {
  const source = useLoader(FBXLoader, MODEL_PATHS.handArm);
  const model = useMemo(() => {
    const rig = cloneSkeleton(source);
    rig.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.frustumCulled = false; // skinned bounds don't follow the moving root
      // the FBX references external texture files that ship separately — without
      // them the authored materials render black, so use a surgical-glove material
      const glove = new THREE.MeshStandardMaterial({ color: "#9fc6d8", roughness: .5, metalness: .05 });
      object.material = Array.isArray(object.material) ? object.material.map(() => glove) : glove;
    });
    rig.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rig);
    const size = box.getSize(new THREE.Vector3());
    const scale = HAND_MODEL_SIZE / (Math.max(size.x, size.y, size.z) || 1);
    const center = box.getCenter(new THREE.Vector3());
    rig.scale.multiplyScalar(scale);
    rig.position.copy(center).multiplyScalar(-scale);
    return rig;
  }, [source]);
  return <primitive object={model} />;
}

function FallbackHand() {
  return <group>
    <mesh castShadow><boxGeometry args={[.32, .09, .38]} /><meshStandardMaterial color="#7fb2c9" roughness={.6} /></mesh>
    {[-.11, -.04, .04, .11].map(x => <mesh key={x} castShadow position={[x, 0, .29]}><boxGeometry args={[.055, .07, .22]} /><meshStandardMaterial color="#7fb2c9" roughness={.6} /></mesh>)}
    <mesh castShadow position={[.2, 0, .05]} rotation={[0, .5, 0]}><boxGeometry args={[.06, .07, .18]} /><meshStandardMaterial color="#7fb2c9" roughness={.6} /></mesh>
  </group>;
}
