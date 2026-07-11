"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import { useSimulation } from "./SimulationProvider";
import { ModelErrorBoundary, SafeMedicalGLB } from "./ModelRegistry";
import { MODEL_PATHS } from "@/data/modelConfig";
import { WORKSPACE, damp, palmPose, springStep } from "@/lib/handPhysics.mjs";

type Landmark = { x: number; y: number; z: number };
export type TrackedHand = {
  handedness: string;
  gesture: string;
  pinch: boolean;
  pointer: { x: number; y: number };
  landmarks: Landmark[];
  side: Side;
};

type Side = "Left" | "Right";

/** Latest detections, written by the driver and read at render rate by useFrame. */
export const handStore: { hands: TrackedHand[]; at: number; gripSide: Side | null } = { hands: [], at: 0, gripSide: null };

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/gesture_recognizer.task";
const RELEASE_MS = 600; // sustained open palms before the tool returns to the tray
const STALE_MS = 400; // no detection for this long → hand parks by the tray
const PINCH_RATIO = .35; // thumb→index tip distance relative to hand size

// Calibration knob for the tracked GLB proxy.
const HAND_LENGTH = .62;
const FLIP_HANDEDNESS = false; // flip if the on-screen hands mirror your real ones
const PARK: Record<Side, { x: number; y: number; z: number }> = {
  Right: { x: 2.3, y: 2.35, z: 1.5 },
  Left: { x: -2.3, y: 2.35, z: 1.5 },
};

/**
 * Which surgeon hand a detection drives. Screen position is the ground truth:
 * the camera faces you, so the hand on the image's left half is your physical
 * right hand. With two hands present we sort by position, which is immune to
 * MediaPipe's (noisy, mirror-convention) handedness labels; with one hand we
 * fall back to the label, inverted because we feed raw un-mirrored frames.
 */
function assignSides(hands: Omit<TrackedHand, "side">[]): TrackedHand[] {
  if (hands.length === 2) {
    const sorted = [...hands].sort((a, b) => a.landmarks[0].x - b.landmarks[0].x);
    return [{ ...sorted[0], side: "Right" as const }, { ...sorted[1], side: "Left" as const }];
  }
  return hands.map(hand => ({ ...hand, side: hand.handedness === "Left" ? "Right" as const : "Left" as const }));
}

const HAND_CONNECTIONS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]] as const;
const SIDE_COLORS: Record<Side, string> = { Right: "#5fd4de", Left: "#f0c25e" };

type TrackingPhase = "starting" | "denied" | "offline" | "active";

/**
 * DOM side of gesture control: runs MediaPipe gesture recognition directly in
 * the browser (GPU-accelerated, per video frame — no backend round trip),
 * publishes every detected hand into `handStore`, and shows a
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
    let recognizer: GestureRecognizer | null = null;
    let rafId = 0;
    let lastVideoTime = -1;
    let openSince = 0;

    const drawOverlay = (hands: TrackedHand[]) => {
      const overlay = overlayRef.current;
      const context = overlay?.getContext("2d");
      if (!overlay || !context) return;
      context.clearRect(0, 0, overlay.width, overlay.height);
      for (const hand of hands) {
        const color = SIDE_COLORS[hand.side];
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

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const video = videoRef.current;
      if (stopped || !video || !recognizer || video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;
      const now = performance.now();
      const result = recognizer.recognizeForVideo(video, now);
      const hands = assignSides(result.landmarks.slice(0, 2).map((landmarks, i) => {
        const size = Math.hypot(landmarks[9].x - landmarks[0].x, landmarks[9].y - landmarks[0].y) || 1;
        const gestureName = result.gestures[i]?.[0]?.categoryName ?? "";
        return {
          handedness: result.handedness[i]?.[0]?.categoryName ?? "Right",
          gesture: gestureName === "None" ? "" : gestureName,
          pinch: Math.hypot(landmarks[4].x - landmarks[8].x, landmarks[4].y - landmarks[8].y) < size * PINCH_RATIO,
          pointer: { x: 1 - landmarks[8].x, y: landmarks[8].y },
          landmarks,
        };
      }));
      handStore.hands = hands;
      handStore.at = now;
      const pinching = hands.find(hand => hand.pinch);
      handStore.gripSide = pinching ? pinching.side : null;
      setGesture(hands.length
        ? hands.map(hand => `${hand.side[0]}·${hand.pinch ? "Pinch" : hand.gesture?.replace(/_/g, " ") || "Hand"}`).join("  ")
        : "No hands");
      drawOverlay(hands);
      if (hands.length && hands.every(hand => hand.gesture === "Open_Palm" && !hand.pinch)) {
        openSince ||= now;
        if (now - openSince > RELEASE_MS && simRef.current.selectedTool) { simRef.current.releaseTool(); openSince = 0; }
      } else openSince = 0;
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch {
        if (!stopped) setPhase("denied");
        return;
      }
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
        const options = (delegate: "GPU" | "CPU") => ({
          baseOptions: { modelAssetPath: MODEL_PATH, delegate },
          runningMode: "VIDEO" as const,
          numHands: 2,
        });
        recognizer = await GestureRecognizer.createFromOptions(fileset, options("GPU"))
          .catch(() => GestureRecognizer.createFromOptions(fileset, options("CPU")));
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setPhase("active");
        rafId = requestAnimationFrame(tick);
      } catch {
        if (!stopped) setPhase("offline");
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach(track => track.stop());
      recognizer?.close();
      handStore.hands = [];
      handStore.gripSide = null;
    };
  }, []);

  const label = phase === "starting" ? "Starting camera…" : phase === "denied" ? "Camera blocked" : phase === "offline" ? "Tracking failed to load" : "Hand tracking";
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

const basisQuat = (across: THREE.Vector3, forward: THREE.Vector3, up: THREE.Vector3) =>
  new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, forward, up));

/** Both surgeon hands, each independently driven by its detected counterpart. */
export function GestureHand() {
  return <>
    <ModelErrorBoundary fallback={<group />}><Suspense fallback={<group />}><TrackedGLBHand side="Right" /></Suspense></ModelErrorBoundary>
    <ModelErrorBoundary fallback={<group />}><Suspense fallback={<group />}><TrackedGLBHand side="Left" /></Suspense></ModelErrorBoundary>
  </>;
}

/** One hand from hand.glb, visible only while MediaPipe reports that side. */
function TrackedGLBHand({ side }: { side: Side }) {
  const { scene } = useGLTF(MODEL_PATHS.hand);
  const root = useRef<THREE.Group>(null);
  const rot = useRef<THREE.Group>(null);
  const park = PARK[side];
  const axes = useRef({
    x: { value: park.x, velocity: 0 },
    y: { value: park.y, velocity: 0 },
    z: { value: park.z, velocity: 0 },
    grip: { value: 0, velocity: 0 },
  });
  const { state } = useSimulation();
  const toolPath = state.selectedTool ? TOOL_ASSETS[state.selectedTool] : undefined;

  const hand = useMemo(() => {
    const armatures = scene.children.filter(child => {
      let skinned = false;
      child.traverse(object => { if (object instanceof THREE.SkinnedMesh) skinned = true; });
      return skinned;
    }).sort((a, b) => a.position.x - b.position.x);
    const source = (side === "Right" ? armatures[0] : armatures.at(-1)) ?? armatures[0] ?? scene.children[0];
    if (!source) return new THREE.Group();
    const model = cloneSkeleton(source);
    model.position.set(0, 0, 0);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const scale = HAND_LENGTH / (Math.max(size.x, size.y, size.z) || 1);
    model.scale.multiplyScalar(scale);
    model.position.copy(center).multiplyScalar(-scale);
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = false;
    });
    return model;
  }, [scene, side]);

  useFrame((_, delta) => {
    const group = root.current;
    const rotGroup = rot.current;
    if (!group || !rotGroup) return;
    const fresh = performance.now() - handStore.at < STALE_MS;
    const live = fresh ? handStore.hands.find(hand => (FLIP_HANDEDNESS ? (hand.side === "Right" ? "Left" : "Right") : hand.side) === side) ?? null : null;
    group.visible = Boolean(live);
    if (!live) return;
    const pose = palmPose(live);
    const a = axes.current;
    // stiff springs: tracking is realtime now, so follow tightly and let the
    // damping kill jitter rather than adding visible lag
    springStep(a.x, pose.x, delta, 170, 26);
    springStep(a.y, pose.y, delta, 170, 26);
    springStep(a.z, pose.z, delta, 170, 26);
    springStep(a.grip, pose.grip, delta, 40, 12);
    group.position.set(a.x.value, Math.max(a.y.value, WORKSPACE.floorY), a.z.value);

    if (pose.axes) {
      const target = basisQuat(
        new THREE.Vector3(...pose.axes.across),
        new THREE.Vector3(...pose.axes.forward),
        new THREE.Vector3(...pose.axes.up),
      );
      rotGroup.quaternion.slerp(target, damp(14, delta));
    }
  });

  return <group ref={root} visible={false} position={[park.x, park.y, park.z]}>
    <group ref={rot}>
      <primitive object={hand} />
      {toolPath && <GrippedTool path={toolPath} side={side} axesRef={axes} />}
    </group>
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
    <SafeMedicalGLB path={path} targetSize={.62} color="#bcc8cc" metalness={.84} roughness={.2} preserveTextures={false} position={[0, .22, .08]} rotation={[Math.PI / 2, 0, 0]} fallback={<group />} />
  </group>;
}
