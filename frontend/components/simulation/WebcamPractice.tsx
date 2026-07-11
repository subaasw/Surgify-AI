"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Hand, RefreshCw, ScanLine } from "lucide-react";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import { LandmarkFilter, classifyPose } from "@/lib/handPhysics.mjs";
import { useSimulation } from "./SimulationProvider";
import { handStore, type TrackedHand } from "./GestureHandControl";

type TrackingStatus = "idle" | "requesting" | "connecting" | "active" | "failed";

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/gesture_recognizer.task";
const PINCH_RATIO = .35; // thumb→index tip distance relative to hand size
const LATCH_MS = 420; // gesture must hold this long before it fires
const ACTION_COOLDOWN_MS = 1100;
const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]] as const;
const TOOL_TARGETS = [
  { tool: "Needle holder", x: .16, y: .84 },
  { tool: "Forceps", x: .38, y: .84 },
  { tool: "Surgical scissors", x: .62, y: .84 },
  { tool: "Curved needle", x: .84, y: .84 },
] as const;

type Hud = { handedness: string; gesture: string; confidence: number; latency: number };

/**
 * Practice view driven entirely by on-device MediaPipe: the GestureRecognizer
 * runs in the browser (GPU, per video frame) — no backend round trip, so
 * tracking follows the camera at full frame rate instead of ~5 fps over HTTP.
 */
export function WebcamPractice() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const loopRef = useRef<number | null>(null);
  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [error, setError] = useState("");
  const [hud, setHud] = useState<Hud>({ handedness: "", gesture: "", confidence: 0, latency: 0 });
  const [nearTool, setNearTool] = useState<string | null>(null);
  const [pinching, setPinching] = useState(false);
  const { state, setCameraMode, selectRegion, selectTool, releaseTool } = useSimulation();
  const sim = useRef({ selectedTool: state.selectedTool, selectRegion, selectTool, releaseTool });
  sim.current = { selectedTool: state.selectedTool, selectRegion, selectTool, releaseTool };

  const stopCamera = useCallback(() => {
    if (loopRef.current !== null) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    recognizerRef.current?.close();
    recognizerRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    handStore.hands = [];
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setError("");
    setStatus("requesting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not support camera access.");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setStatus("connecting");
    } catch (cameraError) {
      setError(cameraError instanceof Error ? cameraError.message : "Camera permission was denied or no camera was found.");
      setStatus("failed");
      return;
    }

    try {
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      const options = (delegate: "GPU" | "CPU") => ({
        baseOptions: { modelAssetPath: MODEL_PATH, delegate },
        runningMode: "VIDEO" as const,
        numHands: 1,
        cannedGesturesClassifierOptions: { scoreThreshold: .4 },
      });
      const recognizer = await GestureRecognizer.createFromOptions(fileset, options("GPU"))
        .catch(() => GestureRecognizer.createFromOptions(fileset, options("CPU")));
      if (!streamRef.current) { recognizer.close(); return; } // user backed out while the model loaded
      recognizerRef.current = recognizer;
      setStatus("active");
    } catch {
      setError("On-device hand tracking failed to load. Check that /mediapipe assets are served.");
      setStatus("failed");
    }
  }, [stopCamera]);

  useEffect(() => {
    if (status !== "active") return;
    const filter = new LandmarkFilter(1.2, 5);
    let lastVideoTime = -1;
    let lastNow = 0;
    let lastHudAt = 0;
    const latch = { key: "", since: 0 };
    let lastActionAt = 0;
    let hadHand = false;

    const tick = () => {
      loopRef.current = requestAnimationFrame(tick);
      const video = videoRef.current;
      const overlay = overlayRef.current;
      const recognizer = recognizerRef.current;
      if (!video || !overlay || !recognizer || video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;
      const now = performance.now();
      const dt = lastNow ? (now - lastNow) / 1000 : 0;
      lastNow = now;
      const result = recognizer.recognizeForVideo(video, now);
      const latency = Math.round(performance.now() - now);

      const raw = result.landmarks[0];
      if (!raw) { filter.reset(); latch.key = ""; }
      const landmarks = raw ? filter.apply(raw, dt) : null;
      const handedness = result.handedness[0]?.[0];
      const mlGesture = result.gestures[0]?.[0];
      let gesture = mlGesture && mlGesture.categoryName !== "None" ? mlGesture.categoryName : "";
      if (!gesture && landmarks) gesture = classifyPose(landmarks, result.worldLandmarks[0] ?? landmarks);
      const size = landmarks ? Math.hypot(landmarks[9].x - landmarks[0].x, landmarks[9].y - landmarks[0].y) || 1 : 1;
      const pinch = Boolean(landmarks
        && !["Thumb_Up", "Thumb_Down", "Closed_Fist"].includes(gesture)
        && Math.hypot(landmarks[4].x - landmarks[8].x, landmarks[4].y - landmarks[8].y) < size * PINCH_RATIO);
      const pointer = landmarks ? { x: 1 - landmarks[8].x, y: landmarks[8].y } : null;

      // overlay skeleton, drawn straight from the loop — no react state per frame
      const width = overlay.width = video.videoWidth || 640;
      const height = overlay.height = video.videoHeight || 480;
      const context = overlay.getContext("2d");
      if (context) {
        context.clearRect(0, 0, width, height);
        if (landmarks) {
          context.strokeStyle = "rgba(86, 220, 230, .9)";
          context.lineWidth = 3;
          for (const [from, to] of HAND_CONNECTIONS) {
            context.beginPath();
            context.moveTo(landmarks[from].x * width, landmarks[from].y * height);
            context.lineTo(landmarks[to].x * width, landmarks[to].y * height);
            context.stroke();
          }
          landmarks.forEach((point: { x: number; y: number }, index: number) => {
            context.beginPath();
            context.fillStyle = index === 8 ? "#f6c85f" : "#60e2eb";
            context.arc(point.x * width, point.y * height, index === 8 ? 7 : 4, 0, Math.PI * 2);
            context.fill();
          });
        }
      }

      if (pointerRef.current) {
        pointerRef.current.style.display = pointer ? "" : "none";
        if (pointer) {
          pointerRef.current.style.left = `${pointer.x * 100}%`;
          pointerRef.current.style.top = `${pointer.y * 100}%`;
        }
      }

      const nearest = pointer
        ? TOOL_TARGETS.map(target => ({ ...target, distance: Math.hypot(pointer.x - target.x, pointer.y - target.y) }))
          .sort((a, b) => a.distance - b.distance)[0]
        : null;

      // gesture → action, latched: the pose must hold LATCH_MS before firing
      const gestureName = pinch ? "Pinch" : gesture;
      const key = raw ? `${gestureName}:${nearest?.tool ?? "none"}` : "";
      if (latch.key !== key) { latch.key = key; latch.since = now; }
      if (raw && now - latch.since >= LATCH_MS && now - lastActionAt >= ACTION_COOLDOWN_MS) {
        let acted = false;
        if (gestureName === "Pinch" && nearest && nearest.distance < .13) {
          sim.current.selectTool(nearest.tool);
          acted = true;
        } else if (gestureName === "Pointing_Up" && pointer && pointer.x > .25 && pointer.x < .75 && pointer.y > .2 && pointer.y < .72) {
          sim.current.selectRegion("Right arm");
          acted = true;
        } else if (gestureName === "Open_Palm" && sim.current.selectedTool) {
          sim.current.releaseTool();
          acted = true;
        }
        if (acted) { lastActionAt = now; latch.since = now; }
      }

      // HUD state only twice a second, or immediately when the hand appears/leaves
      if (now - lastHudAt > 500 || Boolean(raw) !== hadHand) {
        lastHudAt = now;
        hadHand = Boolean(raw);
        setHud({
          handedness: handedness?.categoryName ?? "",
          gesture: raw ? gestureName.replaceAll("_", " ") || "Hand" : "",
          confidence: Math.round((Math.max(handedness?.score ?? 0, mlGesture?.score ?? 0) || (raw ? .75 : 0)) * 100),
          latency,
        });
        setNearTool(nearest && nearest.distance < .13 ? nearest.tool : null);
        setPinching(pinch);
      }
    };
    loopRef.current = requestAnimationFrame(tick);
    return () => { if (loopRef.current !== null) cancelAnimationFrame(loopRef.current); };
  }, [status]);

  useEffect(() => {
    if (status !== "idle") return;
    const frame = requestAnimationFrame(() => { void startCamera(); });
    return () => cancelAnimationFrame(frame);
  }, [status, startCamera]);

  useEffect(() => stopCamera, [stopCamera]);

  const gestureName = hud.gesture || "No hand";

  return <div className="webcam-practice">
    <div className="webcam-demo-bg" />
    <video ref={videoRef} className="webcam-mirrored" autoPlay muted playsInline />
    <canvas ref={overlayRef} className="mediapipe-overlay webcam-mirrored" aria-hidden />
    <div className="webcam-pad-overlay"><span className="webcam-incision"/><span className="webcam-entry">ENTRY</span><span className="webcam-exit">EXIT</span><i className="webcam-path"/></div>
    {status === "active" && TOOL_TARGETS.map(target => <div key={target.tool} className={`gesture-tool-target ${state.selectedTool === target.tool ? "selected" : ""} ${nearTool === target.tool ? "near" : ""}`} style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%` }}><span>{target.tool}</span></div>)}
    <div ref={pointerRef} className={`gesture-pointer ${pinching ? "pinching" : ""}`} style={{ display: "none" }} />
    <div className="webcam-mode-badge"><ScanLine size={13} />MediaPipe on-device · {status === "active" ? "Tracking live" : status === "connecting" ? "Loading model" : "Camera ready"}</div>
    <button className="return-room" onClick={() => { stopCamera(); setCameraMode("room"); }}>Return to 3D room</button>

    {(status === "idle" || status === "requesting" || status === "failed") && <div className="camera-start-card">
      {status === "failed" ? <CameraOff size={20} /> : <Camera size={20} />}<strong>{status === "failed" ? "Camera pipeline unavailable" : "Enable hand-gesture control"}</strong>
      <p>{status === "failed" ? error : "Hand tracking runs entirely in your browser — Google MediaPipe detects hands on-device before gesture actions are enabled."}</p>
      <button disabled={status === "requesting"} onClick={startCamera}>{status === "failed" ? <><RefreshCw size={14} />Try again</> : <><Camera size={14} />{status === "requesting" ? "Requesting camera…" : "Enable camera"}</>}</button>
    </div>}

    <div className="tracking-hud mediapipe-hud">
      <span>Pipeline <strong>{status === "active" ? "On-device" : "Waiting"}</strong></span>
      <span>Hand <strong>{hud.handedness || "Not detected"}</strong></span>
      <span>Gesture <strong>{gestureName}</strong></span>
      <span>Confidence <strong>{hud.confidence}%</strong></span>
      <span>Latency <strong>{hud.latency || "—"}{hud.latency ? " ms" : ""}</strong></span>
    </div>
    <div className="gesture-command-panel"><div><Hand size={14} /><strong>{hud.gesture ? `${gestureName} recognized` : "Show one hand to begin"}</strong></div><span>Point: select forearm</span><span>Pinch: pick nearby tool</span><span>Move: position instrument</span><span>Open palm: release</span></div>
  </div>;
}
