"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import { ModelErrorBoundary } from "./ModelRegistry";
import { useSimulation } from "./SimulationProvider";
import { MODEL_PATHS } from "@/data/modelConfig";
import { procedureSteps } from "@/data/simulationData";
import type { CameraMode } from "@/types/simulation";
import { LandmarkFilter, WORKSPACE, classifyPose, damp, fingerDirs, handProjectionDistance, palmPose, rangeValueAt, rayPlaneDistance, relativeCursorAt, sceneSurfaceYAt, springStep, stablePinch } from "@/lib/handPhysics.mjs";
import { MotionTracker, motionStats } from "@/lib/handMetrics.mjs";

type Landmark = { x: number; y: number; z: number };
export type TrackedHand = {
  handedness: string;
  gesture: string;
  pinch: boolean;
  pointer: { x: number; y: number };
  landmarks: Landmark[];
  world: Landmark[]; // metric 3D (meters) — drives orientation and finger joints
  side: Side;
};

export type Side = "Left" | "Right";
type Workspace = typeof WORKSPACE;

export type HandWorldState = {
  live: boolean;
  pinch: boolean;
  gesture: string;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  /** World-space midpoint between thumb and index fingertips — where a pinched object sits. */
  pinchPoint: THREE.Vector3;
  velocity: THREE.Vector3;
  reach: number;
  holding: boolean;
  contactLift: number;
};

const emptyHandWorld = (): HandWorldState => ({
  live: false, pinch: false, gesture: "",
  position: new THREE.Vector3(), quaternion: new THREE.Quaternion(),
  pinchPoint: new THREE.Vector3(), velocity: new THREE.Vector3(), reach: 0, holding: false, contactLift: 0,
});

/** World-space pose of each rendered surgeon hand, written per frame by RiggedHand for the physics layer. */
export const handWorld: Record<Side, HandWorldState> = { Right: emptyHandWorld(), Left: emptyHandWorld() };

/** Latest detections, written by the driver and read at render rate by useFrame. */
export const handStore: {
  hands: TrackedHand[];
  at: number;
  /** Depth mapping personalized during calibration; null until an open palm has been shown. */
  workspace: Workspace | null;
} = { hands: [], at: 0, workspace: null };

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/gesture_recognizer.task";
const STALE_MS = 400; // no detection for this long → hand fades out
const PINCH_PRESS_RATIO = .38; // easier to trigger a grab…
const PINCH_RELEASE_RATIO = .5; // …with hysteresis so it doesn't flicker back open
const HAND_LENGTH = .62; // wrist → middle fingertip, world units
const CALIBRATION_FRAMES = 40;
const FILTER_CUTOFF = 1.2;
const FILTER_BETA = 5;

function assignSides<T extends { handedness: string; landmarks: Landmark[] }>(hands: T[]): (T & { side: Side })[] {
  const labeled = hands.map(hand => ({ ...hand, side: hand.handedness === "Left" ? "Right" as const : "Left" as const }));
  if (new Set(labeled.map(hand => hand.side)).size === labeled.length) return labeled;
  const sorted = [...hands].sort((a, b) => a.landmarks[0].x - b.landmarks[0].x);
  return sorted.map((hand, index) => ({ ...hand, side: index === 0 ? "Right" as const : "Left" as const }));
}

const HAND_CONNECTIONS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]] as const;
const SIDE_COLORS: Record<Side, string> = { Right: "#5fd4de", Left: "#f0c25e" };

type TrackingPhase = "starting" | "denied" | "offline" | "calibrating" | "active";
type PinchState = { active: boolean; candidate: boolean; frames: number };

const CONTROL_SELECTOR = 'button:not(:disabled),a[href],input[type="range"],[role="button"]:not([aria-disabled="true"])';

// Radial command menu — each entry is a scene view (incl. zoom), an instrument, or a toggle.
type MenuItem = { label: string } & ({ view: CameraMode } | { toggle: true });
const HAND_MENU: MenuItem[] = [
  { label: "Zoom in", view: "closeup" },
  { label: "Zoom out", view: "room" },
  { label: "Patient", view: "patient" },
  { label: "Anatomy", toggle: true },
];

// Shared UI-interaction state the physics layer reads: while the wheel is open,
// a pinch selects a menu item, so grabbing is suppressed to avoid double meaning.
export const interactionState = { menuOpen: false, surgeryActive: false };

/** Meshes hands should rest on top of (patient body, etc.), registered by the scene. */
export const collisionMeshes: THREE.Object3D[] = [];
const surfaceRay = new THREE.Raycaster();
const rayFrom = new THREE.Vector3();
const RAY_DOWN = new THREE.Vector3(0, -1, 0);

/** True surface height under (x,z): the real patient mesh via raycast, else the analytic bed/tray/floor. */
function surfaceUnder(x: number, z: number) {
  let y = sceneSurfaceYAt(x, z);
  if (collisionMeshes.length) {
    rayFrom.set(x, 5, z);
    surfaceRay.set(rayFrom, RAY_DOWN);
    const hit = surfaceRay.intersectObjects(collisionMeshes, true).find(h => (h.object as THREE.Mesh).isMesh);
    if (hit) y = Math.max(y, hit.point.y);
  }
  return y;
}

function controlLabel(target: HTMLElement | null) {
  if (!target) return "";
  return (target.getAttribute("aria-label") || target.getAttribute("title") || target.textContent || "Control")
    .replace(/\s+/g, " ").trim().slice(0, 56);
}

function setRangeFromPointer(input: HTMLInputElement, clientX: number) {
  const rect = input.getBoundingClientRect();
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const step = input.step === "any" ? (max - min) / 100 : Number(input.step || 1);
  const value = rangeValueAt(clientX, rect.left, rect.width, min, max, step);
  if (Math.abs(Number(input.value) - value) < step / 2) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, String(value));
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}


export function HandTrackingDriver() {
  const { state, setCameraMode, setMovementMode, toggleAnatomy } = useSimulation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<TrackingPhase>("starting");
  const [gesture, setGesture] = useState("No hands");
  const [targetLabel, setTargetLabel] = useState("");
  const objective = procedureSteps[state.currentStep];
  const [motion, setMotion] = useState("");
  // VR-style radial command wheel: double-pinch the left hand to open, aim the
  // hand at a clockwise segment to highlight it, rest on it to commit.
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuHighlight, setMenuHighlight] = useState(-1);
  const menuOpenRef = useRef(false);
  useEffect(() => { menuOpenRef.current = menuOpen; interactionState.menuOpen = menuOpen; }, [menuOpen]);
  useEffect(() => { interactionState.surgeryActive = state.movementMode === "surgical"; return () => { interactionState.surgeryActive = false; }; }, [state.movementMode]);
  // Two-hand double-tap flips surgical⇄normal without touching the mouse — the
  // surgical pointer is suppressed, so a gesture is the only hands-free way back.
  const toggleMovementRef = useRef<() => void>(() => {});
  useEffect(() => { toggleMovementRef.current = () => setMovementMode(state.movementMode === "surgical" ? "normal" : "surgical"); }, [setMovementMode, state.movementMode]);
  const commitRef = useRef<(i: number) => void>(() => {});
  useEffect(() => { commitRef.current = (i: number) => {
      const item = HAND_MENU[i];
      if (!item) return;
      if ("view" in item) setCameraMode(item.view);
      else toggleAnatomy();
      setMenuOpen(false);
      setMenuHighlight(-1);
    };
  }, [setCameraMode, toggleAnatomy]);

  useEffect(() => {
    const cursorNode = cursorRef.current;
    let stopped = false;
    let stream: MediaStream | null = null;
    let recognizer: GestureRecognizer | null = null;
    let rafId = 0;
    let lastVideoTime = -1;
    let lastNow = 0;
    let hovered: HTMLElement | null = null;
    let draggedRange: HTMLInputElement | null = null;
    let confirmPinch: PinchState = { active: false, candidate: false, frames: 0 };
    let cursorPosition: { x: number; y: number } | null = null;
    let moveActive = false;
    let handAnchor = { x: 0, y: 0 };
    let cursorAnchor = { x: 0, y: 0 };
    let publishedTarget = "";
    let lastMotionAt = 0;
    let bothPinchWas = false;   // were both hands pinching last frame
    let lastBothTapAt = 0;      // time of the first tap of a pending double-tap
    const menuPinchWas: Record<Side, boolean> = { Left: false, Right: false };
    const menuRise: Record<Side, number> = { Left: 0, Right: 0 }; // last pinch rise per hand
    let menuHand: Side | null = null; // hand that opened the wheel — also aims it
    let menuAnchor: { x: number; y: number } | null = null; // hand pos when opened
    let menuAim = -1;        // currently highlighted segment
    let menuDwell = 0;       // seconds the aim has rested on menuAim → commit
    let menuIdle = 0;        // seconds aiming at nothing → auto-close
    let menuAimedOnce = false;
    let menuAimPinchWas = false; // pinch rising-edge while aiming → instant select
    let menuOpenAt = 0;
    const calSizes: number[] = [];
    const filters: Record<Side, { image: LandmarkFilter; world: LandmarkFilter }> = {
      Right: { image: new LandmarkFilter(FILTER_CUTOFF, FILTER_BETA), world: new LandmarkFilter(FILTER_CUTOFF, FILTER_BETA) },
      Left: { image: new LandmarkFilter(FILTER_CUTOFF, FILTER_BETA), world: new LandmarkFilter(FILTER_CUTOFF, FILTER_BETA) },
    };
    const gesturePinch: Record<Side, PinchState> = {
      Right: { active: false, candidate: false, frames: 0 },
      Left: { active: false, candidate: false, frames: 0 },
    };

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
        context.lineWidth = 2.6;
        context.beginPath();
        for (const [a, b] of HAND_CONNECTIONS) { context.moveTo(px(a), py(a)); context.lineTo(px(b), py(b)); }
        context.stroke();
        context.fillStyle = color;
        for (let i = 0; i < hand.landmarks.length; i++) { context.beginPath(); context.arc(px(i), py(i), 3, 0, Math.PI * 2); context.fill(); }
        if (hand.pinch) { context.strokeStyle = "#63e08d"; context.lineWidth = 3; context.beginPath(); context.arc((px(4) + px(8)) / 2, (py(4) + py(8)) / 2, 12, 0, Math.PI * 2); context.stroke(); }
        context.font = "600 14px system-ui";
        context.fillStyle = "#eafcff";
        const label = `${hand.side} · ${hand.pinch ? "Pinch" : hand.gesture?.replace(/_/g, " ") || "Hand"}`;
        context.fillText(label, Math.min(px(0), overlay.width - context.measureText(label).width - 3), Math.min(py(0) + 12, overlay.height - 4));
      }
    };

    const publishTarget = (label: string) => {
      if (label === publishedTarget) return;
      publishedTarget = label;
      setTargetLabel(label);
    };

    const clearHandControl = () => {
      hovered?.classList.remove("hand-hover");
      hovered = null;
      draggedRange = null;
      confirmPinch = { active: false, candidate: false, frames: 0 };
      cursorPosition = null;
      moveActive = false;
      publishTarget("");
      if (cursorNode) cursorNode.hidden = true;
    };

    const updateHandControl = (hands: TrackedHand[]) => {
      if (interactionState.surgeryActive) { clearHandControl(); return; }
      const leftHand = hands.find(item => item.side === "Left");
      const rightHand = hands.find(item => item.side === "Right");
      const cursor = cursorRef.current;
      const root = document.querySelector<HTMLElement>(".simulation-page");
      if (!cursor || !root) { clearHandControl(); return; }

      const bounds = root.getBoundingClientRect();
      // a hand busy gripping a physics object doesn't also drive the UI cursor
      if (leftHand?.pinch && !handWorld.Left.holding) {
        if (!moveActive) {
          moveActive = true;
          handAnchor = { ...leftHand.pointer };
          cursorPosition ??= { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
          cursorAnchor = { ...cursorPosition };
        }
        cursorPosition = relativeCursorAt(leftHand.pointer, handAnchor, cursorAnchor, bounds);
      } else moveActive = false;
      const transition = stablePinch(confirmPinch, Boolean(rightHand?.pinch) && !handWorld.Right.holding);
      confirmPinch = transition.state;
      if (!cursorPosition) {
        cursor.hidden = true;
        if (transition.event === "release") draggedRange = null;
        return;
      }
      const { x: clientX, y: clientY } = cursorPosition;
      cursor.hidden = false;
      cursor.style.left = `${clientX}px`;
      cursor.style.top = `${clientY}px`;
      cursor.classList.toggle("moving", Boolean(leftHand?.pinch));
      cursor.classList.toggle("pinching", Boolean(rightHand?.pinch));

      const raw = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      let target = raw?.closest<HTMLElement>(CONTROL_SELECTOR) ?? null;
      if (target && !root.contains(target)) target = null;
      if (draggedRange && confirmPinch.active) target = draggedRange;
      if (target !== hovered) {
        hovered?.classList.remove("hand-hover");
        hovered = target;
        hovered?.classList.add("hand-hover");
      }
      publishTarget(controlLabel(target));

      if (transition.event === "press" && target) {
        if (target instanceof HTMLInputElement && target.type === "range") {
          draggedRange = target;
          setRangeFromPointer(target, clientX);
        } else {
          target.click();
        }
      }
      if (confirmPinch.active && draggedRange) setRangeFromPointer(draggedRange, clientX);
      if (transition.event === "release") draggedRange = null;
    };

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const video = videoRef.current;
      if (stopped || !video || !recognizer || video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;
      const now = performance.now();
      const dt = lastNow ? (now - lastNow) / 1000 : 0;
      lastNow = now;
      const overlay = overlayRef.current;
      if (overlay && video.videoWidth && (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight)) {
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
      }
      const result = recognizer.recognizeForVideo(video, now);

      const detected = assignSides(result.landmarks.slice(0, 2).map((landmarks, i) => ({
        handedness: result.handedness[i]?.[0]?.categoryName ?? "Right",
        rawGesture: result.gestures[i]?.[0]?.categoryName ?? "",
        landmarks,
        world: result.worldLandmarks[i] ?? landmarks,
      })));
      for (const side of ["Right", "Left"] as const) {
        if (!detected.some(hand => hand.side === side)) {
          filters[side].image.reset(); filters[side].world.reset();
          gesturePinch[side] = { active: false, candidate: false, frames: 0 };
        }
      }
      const hands: TrackedHand[] = detected.map(hand => {
        const landmarks = filters[hand.side].image.apply(hand.landmarks, dt);
        const world = filters[hand.side].world.apply(hand.world, dt);
        const raw = hand.rawGesture === "None" ? "" : hand.rawGesture;
        const gestureName = raw || classifyPose(landmarks, world);
        const size = Math.hypot(landmarks[9].x - landmarks[0].x, landmarks[9].y - landmarks[0].y) || 1;
        // Only thumbs-up/down are excluded (they park the thumb near the index
        // and would read as a false pinch). A closed fist now counts as a pinch:
        // "close your hand to grab" is exactly the intended grab gesture.
        const pinchable = !["Thumb_Up", "Thumb_Down"].includes(gestureName);
        const ratio = Math.hypot(landmarks[4].x - landmarks[8].x, landmarks[4].y - landmarks[8].y) / size;
        const pinching = pinchable && (gestureName === "Closed_Fist"
          || ratio < (gesturePinch[hand.side].active ? PINCH_RELEASE_RATIO : PINCH_PRESS_RATIO));
        gesturePinch[hand.side] = stablePinch(gesturePinch[hand.side], pinching, 2).state;
        return {
          handedness: hand.handedness,
          gesture: gestureName,
          pinch: gesturePinch[hand.side].active,
          pointer: { x: 1 - landmarks[8].x, y: landmarks[8].y },
          landmarks,
          world,
          side: hand.side,
        };
      });
      drawOverlay(hands);

      if (!handStore.workspace) {
        // calibration: hold an open palm at a comfortable distance; its median
        // apparent size anchors the depth mapping to this user's own reach
        const palm = hands.find(hand => hand.gesture === "Open_Palm");
        if (palm) calSizes.push(Math.hypot(palm.landmarks[9].x - palm.landmarks[0].x, palm.landmarks[9].y - palm.landmarks[0].y));
        if (calSizes.length >= CALIBRATION_FRAMES) {
          const rest = [...calSizes].sort((a, b) => a - b)[calSizes.length >> 1];
          handStore.workspace = { ...WORKSPACE, sizeFar: rest * .6, sizeNear: rest * 1.55 };
          setPhase("active");
        } else {
          setGesture(`${Math.round(calSizes.length / CALIBRATION_FRAMES * 100)}%`);
        }
        clearHandControl();
        return; // hands stay parked until calibrated
      }

      handStore.hands = hands;
      handStore.at = now;

      // Two-hand double-tap toggles surgical⇄normal. A simultaneous two-hand
      // pinch is a distinct, deliberate act (held tools are a sustained pinch,
      // not a tap), so this won't fire while operating. Runs in both modes.
      const bothPinch = hands.length === 2 && hands.every(hand => hand.pinch)
        && !handWorld.Left.holding && !handWorld.Right.holding; // grabbing tools ≠ mode gesture
      if (bothPinch && !bothPinchWas) {
        if (now - lastBothTapAt < 550) { toggleMovementRef.current(); lastBothTapAt = 0; }
        else lastBothTapAt = now;
      }
      bothPinchWas = bothPinch;

      for (const hand of interactionState.surgeryActive ? [] : hands) {
        if (!bothPinch && hand.pinch && !menuPinchWas[hand.side]) { // two-hand taps are the mode gesture, not the menu
          if (now - menuRise[hand.side] < 450) { // double-tap on this hand
            if (menuOpenRef.current) { setMenuOpen(false); menuAnchor = null; menuHand = null; }
            else {
              menuHand = hand.side;
              menuAnchor = { ...hand.pointer };
              menuAim = -1; menuDwell = 0; menuIdle = 0; menuAimedOnce = false; menuOpenAt = now;
              setMenuOpen(true); setMenuHighlight(-1);
            }
          }
          menuRise[hand.side] = now;
        }
        menuPinchWas[hand.side] = hand.pinch;
      }
      if (interactionState.surgeryActive && menuOpenRef.current) setMenuOpen(false);
      for (const side of ["Left", "Right"] as const) if (!hands.some(hand => hand.side === side)) menuPinchWas[side] = false;

      if (menuOpenRef.current) {
        const aimHand = menuHand ? hands.find(hand => hand.side === menuHand) : undefined;
        if (!aimHand || !menuAnchor || now - menuOpenAt > 6000) { // hand lost / hard timeout
          setMenuOpen(false); menuAnchor = null; menuHand = null;
        } else {
          const dx = aimHand.pointer.x - menuAnchor.x, dy = aimHand.pointer.y - menuAnchor.y;
          let idx = -1;
          if (Math.hypot(dx, dy) > 0.055) { // outside the dead zone → aim at a segment
            const rel = Math.atan2(dy, dx) + Math.PI / 2; // 0 at the top item, clockwise
            const step = (Math.PI * 2) / HAND_MENU.length;
            idx = ((Math.round(rel / step) % HAND_MENU.length) + HAND_MENU.length) % HAND_MENU.length;
          }
          if (idx !== menuAim) { menuAim = idx; menuDwell = 0; setMenuHighlight(idx); }
          // pinch on the highlighted segment picks it instantly; resting also commits
          const aimPinch = aimHand.pinch;
          const pinchPicked = aimPinch && !menuAimPinchWas && idx >= 0;
          menuAimPinchWas = aimPinch;
          if (idx < 0) { if (menuAimedOnce) { menuIdle += dt; if (menuIdle > 1.2) { setMenuOpen(false); menuAnchor = null; } } }
          else { menuAimedOnce = true; menuIdle = 0; menuDwell += dt; if (pinchPicked || menuDwell > 0.55) { commitRef.current(idx); menuAnchor = null; menuAim = -1; } }
        }
        if (cursorRef.current) cursorRef.current.hidden = true;
      } else {
        updateHandControl(hands);
      }
      if (now - lastMotionAt > 500) {
        lastMotionAt = now;
        const sides = (["Right", "Left"] as const).filter(side => motionStats[side].live);
        const travelled = motionStats.Right.distance + motionStats.Left.distance;
        setMotion(sides.length
          ? `path ${travelled.toFixed(2)}m · steady ${Math.round(Math.min(...sides.map(side => motionStats[side].steadiness)) * 100)}%`
          : "");
      }
      setGesture(hands.length
        ? hands.map(hand => `${hand.side[0]}·${hand.pinch ? "Pinch" : hand.gesture?.replace(/_/g, " ") || "Hand"}`).join("  ")
        : "No hands");
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (stopped) { stream.getTracks().forEach(track => track.stop()); return; }
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
          minHandDetectionConfidence: .6, // fewer phantom hands from background clutter
          minHandPresenceConfidence: .6,
          minTrackingConfidence: .6, // steadier landmarks once a hand is locked
          cannedGesturesClassifierOptions: { scoreThreshold: .4 }, // default misses casual thumbs-up
        });
        recognizer = await GestureRecognizer.createFromOptions(fileset, options("GPU"))
          .catch(() => GestureRecognizer.createFromOptions(fileset, options("CPU")));
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setPhase(handStore.workspace ? "active" : "calibrating");
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
      handStore.at = 0;
      hovered?.classList.remove("hand-hover");
      if (cursorNode) cursorNode.hidden = true;
    };
  }, []);

  const label = phase === "starting" ? "Starting camera…"
    : phase === "denied" ? "Camera blocked"
    : phase === "offline" ? "Tracking failed to load"
    : phase === "calibrating" ? "Show an open palm ✋"
    : "Hand tracking";
  const fullCamera = state.cameraMode === "webcam";
  const active = phase === "active" || phase === "calibrating";
  return <>
    <div className={`gesture-camera ${fullCamera ? "full" : "pip"}${active ? "" : " offline"}`}>
      <div className="gesture-camera-feed">
      <video ref={videoRef} muted playsInline />
        <canvas ref={overlayRef} width={640} height={480} />
        <div className="gesture-camera-live"><i /><span>{label}</span></div>
        <div className="gesture-camera-hud">
          <small>Stage {state.currentStep + 1} · {objective.title}{active ? ` · ${state.movementMode === "surgical" ? "🖐 Surgical" : "👆 Pointer"} mode` : ""}</small>
          <strong>{phase === "active" ? state.movementMode === "surgical" ? "Hover a tool (green ring) · pinch to grab · both-hands double-tap = Pointer mode" : menuOpen ? "Aim a mode · pinch or rest to pick" : targetLabel ? `Right pinch · ${targetLabel}` : "Left pinch moves · double-pinch = wheel · both-hands double-tap = Surgical mode" : label}</strong>
          {active && <span>{gesture}</span>}
        </div>
      </div>
    </div>
    {phase === "active" && motion && <div className="gesture-pip-motion">{motion}</div>}
    {phase === "active" && menuOpen && <div className="hand-menu">
      <div className="hand-menu-hub"><small>Aim · rest to pick</small><strong>{menuHighlight >= 0 ? HAND_MENU[menuHighlight].label : "Select mode"}</strong></div>
      {HAND_MENU.map((item, i) => {
        const angle = (-90 + i * (360 / HAND_MENU.length)) * Math.PI / 180;
        const r = 172;
        const active = "view" in item ? state.cameraMode === item.view : state.anatomyOverlay;
        return <button key={item.label} className={`hand-menu-item${active ? " active" : ""}${i === menuHighlight ? " aim" : ""}`}
          style={{ left: `calc(50% + ${(Math.cos(angle) * r).toFixed(1)}px)`, top: `calc(50% + ${(Math.sin(angle) * r).toFixed(1)}px)` }}
          onClick={() => commitRef.current(i)}>{item.label}</button>;
      })}
    </div>}
    <div ref={cursorRef} className="gesture-screen-cursor" hidden aria-hidden="true"><i /><span>{targetLabel || "Left pinch to move"}</span></div>
  </>;
}

const FINGER_NAMES = ["thumb", "index", "middle", "ring", "pinky"] as const;
type FingerName = typeof FINGER_NAMES[number];
type FingerRig = {
  joints: { bone: THREE.Object3D; rest: THREE.Quaternion }[];
  parentRest: THREE.Quaternion; // rig-space orientation of the chain's parent (static: palm bones aren't driven)
};

const basisQuat = (across: THREE.Vector3, up: THREE.Vector3, forward: THREE.Vector3) =>
  new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, up, forward));

// per-frame scratch — the pose loop allocates nothing
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const segDir = new THREE.Vector3();
const vAcross = new THREE.Vector3();
const vUp = new THREE.Vector3();
const vForward = new THREE.Vector3();
const liveBasis = new THREE.Matrix4();
const liveQuat = new THREE.Quaternion();
const worldQuat = new THREE.Quaternion();
const cameraLocal = new THREE.Vector3();
const cameraWorld = new THREE.Vector3();
const parentQuat = new THREE.Quaternion();
const invQuat = new THREE.Quaternion();
const targetQuat = new THREE.Quaternion();
const tipA = new THREE.Vector3();
const tipB = new THREE.Vector3();
const contactPoint = new THREE.Vector3();
const instantVel = new THREE.Vector3();
const trayNdc = new THREE.Vector2();
const trayRay = new THREE.Raycaster();
const trayPoint = new THREE.Vector3();
const trayOffset = new THREE.Vector3();
/** Both surgeon hands, each independently driven by its detected counterpart. */
export function GestureHand({ mode }: { mode: Exclude<CameraMode, "webcam"> | "pov" }) {
  return <>
    <ModelErrorBoundary fallback={<group />}><Suspense fallback={<group />}><RiggedHand side="Right" mode={mode} /></Suspense></ModelErrorBoundary>
    <ModelErrorBoundary fallback={<group />}><Suspense fallback={<group />}><RiggedHand side="Left" mode={mode} /></Suspense></ModelErrorBoundary>
  </>;
}


function RiggedHand({ side, mode }: { side: Side; mode: Exclude<CameraMode, "webcam"> | "pov" }) {
  const { scene } = useGLTF(MODEL_PATHS.hand);
  const { camera } = useThree();
  const root = useRef<THREE.Group>(null);
  const rot = useRef<THREE.Group>(null);
  const wasLive = useRef(false);
  const axes = useRef({
    x: { value: 0, velocity: 0 },
    y: { value: 0, velocity: 0 },
    z: { value: -3, velocity: 0 },
  });

  const { rig, restQuatInv, restPalm, fingers, tips, contactTips } = useMemo(() => {
    // the GLB holds both hands; the right one rests on the +x side
    const sources = scene.children
      .filter(child => { let skinned = false; child.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true; }); return skinned; })
      .sort((a, b) => a.position.x - b.position.x);
    const rig = cloneSkeleton(sources[side === "Right" ? sources.length - 1 : 0] ?? scene.children[0]);
    rig.position.set(0, 0, 0);
    rig.updateMatrixWorld(true);
    let mesh: THREE.SkinnedMesh | undefined;
    rig.traverse(object => {
      if ((object as THREE.SkinnedMesh).isSkinnedMesh) mesh = object as THREE.SkinnedMesh;
      if ((object as THREE.Mesh).isMesh) { object.castShadow = true; object.frustumCulled = false; }
    });
    const wrist = mesh!.skeleton.bones[0];
    // each child of the wrist starts one finger chain: metacarpal + phalanges
    const chains = wrist.children.map(start => {
      const chain: THREE.Object3D[] = [start];
      while (chain[chain.length - 1].children[0]) chain.push(chain[chain.length - 1].children[0]);
      return chain;
    });
    const at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
    const thumb = chains.find(chain => chain.length === 3) ?? chains[0];
    const byGap = chains.filter(chain => chain !== thumb)
      .map(chain => ({ chain, gap: at(chain[1]).distanceTo(at(thumb[1])) }))
      .sort((a, b) => a.gap - b.gap);
    const chainOf: Record<FingerName, THREE.Object3D[]> = {
      thumb, index: byGap[0].chain, middle: byGap[1].chain, ring: byGap[2].chain, pinky: byGap[3].chain,
    };
    // rest palm basis from the rig's own knuckles — same construction as the
    // live landmark basis, so live-over-rest transfers the pose exactly
    const wristAt = at(wrist);
    const forward = at(chainOf.middle[1]).sub(wristAt).normalize();
    const up = new THREE.Vector3().crossVectors(forward, at(chainOf.index[1]).sub(at(chainOf.pinky[1])).normalize()).normalize();
    const across = new THREE.Vector3().crossVectors(up, forward).normalize();
    // wrist → middle fingertip sets the on-screen hand size, wrist is the pivot
    const middleTip = chainOf.middle[chainOf.middle.length - 1];
    const span = wristAt.distanceTo(at(middleTip)) * 1.15 || 1;
    rig.scale.multiplyScalar(HAND_LENGTH / span);
    rig.updateMatrixWorld(true);
    rig.position.copy(at(wrist)).negate();
    const fingers = {} as Record<FingerName, FingerRig>;
    for (const name of FINGER_NAMES) {
      const joints = chainOf[name].slice(-3).map(bone => ({ bone, rest: bone.quaternion.clone() }));
      fingers[name] = { joints, parentRest: joints[0].bone.parent!.getWorldQuaternion(new THREE.Quaternion()) };
    }
    // leaf bones sit at the fingertips — their midpoint is the pinch point
    const tips = { thumb: chainOf.thumb[chainOf.thumb.length - 1], index: chainOf.index[chainOf.index.length - 1] };
    const contactTips = [wrist, ...Object.values(chainOf).map(chain => chain[chain.length - 1])];
    return { rig, restQuatInv: basisQuat(across, up, forward).invert(), restPalm: { across, up, forward }, fingers, tips, contactTips };
  }, [scene, side]);
  const trackerRef = useRef(new MotionTracker());
  useEffect(() => () => { handWorld[side].live = false; handWorld[side].holding = false; motionStats[side].live = false; }, [side]);

  useFrame((_, delta) => {
    const tracker = trackerRef.current;
    const group = root.current;
    const rotGroup = rot.current;
    if (!group || !rotGroup) return;
    const fresh = performance.now() - handStore.at < STALE_MS;
    const live = fresh ? handStore.hands.find(hand => hand.side === side) ?? null : null;
    group.visible = Boolean(live);
    if (!live) {
      wasLive.current = false;
      handWorld[side].live = false;
      motionStats[side].live = false;
      return;
    }
    const pose = palmPose(live, handStore.workspace ?? WORKSPACE);
    const a = axes.current;

    vAcross.set(pose.axes.across[0], pose.axes.across[1], pose.axes.across[2]);
    vUp.set(pose.axes.up[0], pose.axes.up[1], pose.axes.up[2]);
    vForward.set(pose.axes.forward[0], pose.axes.forward[1], pose.axes.forward[2]);
    liveQuat.setFromRotationMatrix(liveBasis.makeBasis(vAcross, vUp, vForward)).multiply(restQuatInv);
    worldQuat.copy(camera.quaternion).multiply(liveQuat);

    const distance = handProjectionDistance(mode, pose.screen.depth);
    const perspective = camera as THREE.PerspectiveCamera;
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(perspective.fov || 44) / 2) * distance;
    const targetX = pose.screen.x * halfHeight * (perspective.aspect || 1) * .82;
    const targetY = pose.screen.y * halfHeight * .72;
    const targetZ = -distance;

    if (!wasLive.current) { // reappearing: snap to the hand, don't fly in
      wasLive.current = true;
      a.x.value = targetX; a.y.value = targetY; a.z.value = targetZ;
      a.x.velocity = a.y.velocity = a.z.velocity = 0;
      rotGroup.quaternion.copy(worldQuat);
    }
    // stiff springs: tracking is realtime, so follow tightly and let the
    // damping kill jitter rather than adding visible lag
    springStep(a.x, targetX, delta, 170, 26);
    springStep(a.y, targetY, delta, 170, 26);
    springStep(a.z, targetZ, delta, 170, 26);
    cameraLocal.set(a.x.value, a.y.value, a.z.value);
    cameraWorld.copy(cameraLocal).applyQuaternion(camera.quaternion).add(camera.position);
    // keep the hand inside the operating room — never let it drift into walls/void
    cameraWorld.x = THREE.MathUtils.clamp(cameraWorld.x, -3.3, 3.3);
    cameraWorld.z = THREE.MathUtils.clamp(cameraWorld.z, -3.7, 3.7);
    cameraWorld.y = Math.min(cameraWorld.y, 4.2);
    cameraWorld.y = Math.max(cameraWorld.y, sceneSurfaceYAt(cameraWorld.x, cameraWorld.z) + .05);
    group.position.copy(cameraWorld);
    rotGroup.quaternion.slerp(worldQuat, damp(20, delta));

    // skeletal retargeting: aim every phalanx at its landmark segment,
    // expressed in the palm basis so it composes with the hand orientation
    const dirs = fingerDirs(live.world, pose.axes) as Record<FingerName, [number, number, number][]>;
    const blend = damp(26, delta);
    for (const name of FINGER_NAMES) {
      const { joints, parentRest } = fingers[name];
      const fdirs = dirs[name];
      parentQuat.copy(parentRest);
      for (let j = 0; j < joints.length; j++) {
        const bone = joints[j].bone;
        const c = fdirs[j];
        segDir.set(0, 0, 0)
          .addScaledVector(restPalm.across, c[0])
          .addScaledVector(restPalm.up, c[1])
          .addScaledVector(restPalm.forward, c[2]);
        if (segDir.lengthSq() < 1e-6) segDir.copy(Y_AXIS); else segDir.normalize();
        segDir.applyQuaternion(invQuat.copy(parentQuat).invert());
        targetQuat.setFromUnitVectors(Y_AXIS, segDir); // bones point along +Y
        bone.quaternion.slerp(targetQuat, blend);
        parentQuat.multiply(bone.quaternion);
      }
    }

    // Align the final retargeted fingertip pose with the tray surface. Doing
    // this after finger posing prevents the bones from moving the pinch away.
    if (mode === "tray") {
      group.updateMatrixWorld(true);
      tips.thumb.getWorldPosition(tipA);
      tips.index.getWorldPosition(tipB);
      tipA.add(tipB).multiplyScalar(.5);
      const x = 1 - (live.landmarks[4].x + live.landmarks[8].x) / 2;
      const y = (live.landmarks[4].y + live.landmarks[8].y) / 2;
      trayNdc.set(x * 2 - 1, 1 - y * 2);
      trayRay.setFromCamera(trayNdc, camera);
      const distance = rayPlaneDistance(trayRay.ray.origin.y, trayRay.ray.direction.y, 1.18);
      if (distance != null) {
        trayRay.ray.at(distance, trayPoint);
        trayPoint.x = THREE.MathUtils.clamp(trayPoint.x, 2.18, 3.42);
        trayPoint.z = THREE.MathUtils.clamp(trayPoint.z, -1, -.24);
        group.position.add(trayOffset.copy(trayPoint).sub(tipA));
        group.updateMatrixWorld(true);
      }
    }

    // publish world-space pose for the physics layer + motion metrics HUD
    const hw = handWorld[side];
    tips.thumb.getWorldPosition(tipA);
    tips.index.getWorldPosition(tipB);
    tipA.add(tipB).multiplyScalar(.5);
    // Lift the whole hand by its deepest wrist/fingertip/tool penetration against
    // whatever solid surface is under them — the real patient mesh (raycast) or bed/tray/floor.
    let lift = mode === "tray" ? 0 : hw.contactLift;
    hw.contactLift = 0;
    surfaceRay.camera = camera; // Line2/Points children need a camera on the ray or their raycast throws on `.near`
    if (mode !== "tray") for (const point of contactTips) {
        point.getWorldPosition(contactPoint);
        lift = Math.max(lift, surfaceUnder(contactPoint.x, contactPoint.z) - contactPoint.y);
      }
    if (lift > 0) {
      group.position.y += lift;
      group.updateMatrixWorld(true);
      tips.thumb.getWorldPosition(tipA);
      tips.index.getWorldPosition(tipB);
      tipA.add(tipB).multiplyScalar(.5);
    }
    if (hw.live && delta > 0) {
      instantVel.copy(tipA).sub(hw.pinchPoint).divideScalar(delta);
      hw.velocity.lerp(instantVel, damp(18, delta));
    } else {
      hw.velocity.set(0, 0, 0);
      const travelled = tracker.distance; // smoothing state restarts, session path survives
      tracker.reset();
      tracker.distance = travelled;
    }
    hw.pinchPoint.copy(tipA);
    hw.position.copy(group.position);
    hw.quaternion.copy(rotGroup.quaternion);
    hw.pinch = live.pinch;
    hw.gesture = live.gesture;
    hw.reach = pose.screen.depth;
    hw.live = true;

    const stats = tracker.update(a.x.value, a.y.value, a.z.value, delta);
    Object.assign(motionStats[side], stats, { live: true });
    motionStats.at = performance.now();
  });

  return <group ref={root} visible={false} scale={mode === "closeup" ? .42 : 1}>
    <group ref={rot}>
      <primitive object={rig} />
    </group>
  </group>;
}

useGLTF.preload(MODEL_PATHS.hand);
