"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CameraOff, Hand, RefreshCw, ScanLine } from "lucide-react";
import { useSimulation } from "./SimulationProvider";
import { handStore, type TrackedHand } from "./GestureHandControl";

type Landmark = { x: number; y: number; z: number };
type VisionHand = {
  handedness: string;
  score: number;
  gesture: string;
  gesture_score: number;
  pinch: boolean;
  pinch_distance: number;
  pointer: { x: number; y: number };
  landmarks: Landmark[];
};
type VisionResult = {
  mode: string;
  tracking_confidence: number;
  hands: VisionHand[];
  warnings: string[];
};
type TrackingStatus = "idle" | "requesting" | "connecting" | "active" | "failed";

const API_URL = process.env.NEXT_PUBLIC_SURGIFY_API_URL ?? "http://localhost:8000/api/v1";
const FRAME_INTERVAL_MS = 180;
const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]] as const;
const TOOL_TARGETS = [
  { tool: "Needle holder", x: .16, y: .84 },
  { tool: "Forceps", x: .38, y: .84 },
  { tool: "Surgical scissors", x: .62, y: .84 },
  { tool: "Curved needle", x: .84, y: .84 },
] as const;

function frameBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", .72));
}

export function WebcamPractice() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const lastFrameRef = useRef(0);
  const gestureLatchRef = useRef({ key: "", frames: 0 });
  const lastActionAtRef = useRef(0);
  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [result, setResult] = useState<VisionResult | null>(null);
  const [error, setError] = useState("");
  const [latency, setLatency] = useState(0);
  const { state, setCameraMode, selectRegion, selectTool, releaseTool } = useSimulation();

  const stopCamera = useCallback(() => {
    if (loopRef.current !== null) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    handStore.hands = [];
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setError("");
    setResult(null);
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
    }
  }, [stopCamera]);

  const analyzeFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = captureRef.current;
    if (!video || !canvas || video.readyState < 2 || !video.videoWidth || inFlightRef.current) return;
    inFlightRef.current = true;
    const started = performance.now();
    try {
      canvas.width = 384;
      canvas.height = Math.round(384 * video.videoHeight / video.videoWidth);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Camera frame capture is unavailable.");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await frameBlob(canvas);
      if (!blob) throw new Error("Could not encode the camera frame.");
      const form = new FormData();
      form.append("frame", blob, "camera-frame.jpg");
      form.append("mode", "mediapipe");
      form.append("timestamp_ms", String(Date.now()));
      const response = await fetch(`${API_URL}/vision/frame`, { method: "POST", body: form });
      if (!response.ok) throw new Error(`Vision service returned ${response.status}.`);
      const next = await response.json() as VisionResult;
      setResult(next);
      setLatency(Math.round(performance.now() - started));
      setStatus("active");
      setError("");

      // Update global handStore for 3D rigged hands
      const trackedHands: TrackedHand[] = next.hands.map(hand => ({
        handedness: hand.handedness,
        gesture: hand.gesture,
        pinch: hand.pinch,
        pointer: hand.pointer,
        landmarks: hand.landmarks,
        world: hand.landmarks,
        side: hand.handedness === "Left" ? "Right" as const : "Left" as const,
      }));
      handStore.hands = trackedHands;
      handStore.at = performance.now();
    } catch (visionError) {
      setError(`${visionError instanceof Error ? visionError.message : "Vision service unavailable"} Start the backend on port 8000.`);
      setStatus("failed");
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (status === "connecting" || status === "active") {
      const tick = (time: number) => {
        if (time - lastFrameRef.current >= FRAME_INTERVAL_MS) {
          lastFrameRef.current = time;
          void analyzeFrame();
        }
        loopRef.current = requestAnimationFrame(tick);
      };
      loopRef.current = requestAnimationFrame(tick);
    }
    return () => { if (loopRef.current !== null) cancelAnimationFrame(loopRef.current); };
  }, [status, analyzeFrame]);

  useEffect(() => {
    if (status !== "idle") return;
    const frame = requestAnimationFrame(() => { void startCamera(); });
    return () => cancelAnimationFrame(frame);
  }, [status, startCamera]);

  useEffect(() => stopCamera, [stopCamera]);

  useEffect(() => {
    const canvas = overlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, width, height);
    for (const hand of result?.hands ?? []) {
      context.strokeStyle = "rgba(86, 220, 230, .9)";
      context.lineWidth = 3;
      for (const [from, to] of HAND_CONNECTIONS) {
        const a = hand.landmarks[from], b = hand.landmarks[to];
        if (!a || !b) continue;
        context.beginPath();
        context.moveTo(a.x * width, a.y * height);
        context.lineTo(b.x * width, b.y * height);
        context.stroke();
      }
      hand.landmarks.forEach((point, index) => {
        context.beginPath();
        context.fillStyle = index === 8 ? "#f6c85f" : "#60e2eb";
        context.arc(point.x * width, point.y * height, index === 8 ? 7 : 4, 0, Math.PI * 2);
        context.fill();
      });
    }
  }, [result]);

  const hand = result?.hands[0] ?? null;
  const pointer = useMemo(() => hand ? { x: 1 - hand.pointer.x, y: hand.pointer.y } : null, [hand]);
  const nearestTool = useMemo(() => {
    if (!pointer) return null;
    return TOOL_TARGETS.map(target => ({ ...target, distance: Math.hypot(pointer.x - target.x, pointer.y - target.y) }))
      .sort((a, b) => a.distance - b.distance)[0];
  }, [pointer]);

  useEffect(() => {
    if (!hand || result!.tracking_confidence < .5 || status !== "active") {
      gestureLatchRef.current = { key: "", frames: 0 };
      return;
    }
    const gesture = hand.pinch ? "Pinch" : hand.gesture;
    const key = `${gesture}:${nearestTool?.tool ?? "none"}`;
    if (gestureLatchRef.current.key === key) gestureLatchRef.current.frames += 1;
    else gestureLatchRef.current = { key, frames: 1 };
    if (gestureLatchRef.current.frames < 3 || Date.now() - lastActionAtRef.current < 1100) return;

    let acted = false;
    if (gesture === "Pinch" && nearestTool && nearestTool.distance < .13) {
      selectTool(nearestTool.tool);
      acted = true;
    } else if (gesture === "Pointing_Up" && pointer && pointer.x > .25 && pointer.x < .75 && pointer.y > .2 && pointer.y < .72) {
      selectRegion("Right arm");
      acted = true;
    } else if (gesture === "Open_Palm" && state.selectedTool) {
      releaseTool();
      acted = true;
    }
    if (acted) {
      lastActionAtRef.current = Date.now();
      gestureLatchRef.current.frames = 0;
    }
  }, [hand, nearestTool, pointer, result, status, state.selectedTool, selectTool, selectRegion, releaseTool]);

  const gestureName = hand ? (hand.pinch ? "Pinch" : hand.gesture.replaceAll("_", " ")) : "No hand";
  const confidence = Math.round((result?.tracking_confidence ?? 0) * 100);

  return <div className="webcam-practice">
    <div className="webcam-demo-bg" />
    <video ref={videoRef} className="webcam-mirrored" autoPlay muted playsInline />
    <canvas ref={captureRef} className="webcam-capture" aria-hidden />
    <canvas ref={overlayRef} className="mediapipe-overlay webcam-mirrored" aria-hidden />
    <div className="webcam-pad-overlay"><span className="webcam-incision"/><span className="webcam-entry">ENTRY</span><span className="webcam-exit">EXIT</span><i className="webcam-path"/></div>
    {status === "active" && TOOL_TARGETS.map(target => <div key={target.tool} className={`gesture-tool-target ${state.selectedTool === target.tool ? "selected" : ""} ${nearestTool?.tool === target.tool ? "near" : ""}`} style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%` }}><span>{target.tool}</span></div>)}
    {pointer && <div className={`gesture-pointer ${hand?.pinch ? "pinching" : ""}`} style={{ left: `${pointer.x * 100}%`, top: `${pointer.y * 100}%` }} />}
    <div className="webcam-mode-badge"><ScanLine size={13}/>MediaPipe · {status === "active" ? "Tracking live" : status === "connecting" ? "Connecting" : "Camera ready"}</div>
    <button className="return-room" onClick={() => { stopCamera(); setCameraMode("room"); }}>Return to 3D room</button>

    {(status === "idle" || status === "requesting" || status === "failed") && <div className="camera-start-card">
      {status === "failed" ? <CameraOff size={25}/> : <Camera size={25}/>}<strong>{status === "failed" ? "Camera pipeline unavailable" : "Enable hand-gesture control"}</strong>
      <p>{status === "failed" ? error : "The camera feed is sampled by the local Surgify backend. Google MediaPipe detects hands before gesture actions are enabled."}</p>
      <button disabled={status === "requesting"} onClick={startCamera}>{status === "failed" ? <><RefreshCw size={13}/>Try again</> : <><Camera size={13}/>{status === "requesting" ? "Requesting camera…" : "Enable camera"}</>}</button>
    </div>}

    <div className="tracking-hud mediapipe-hud">
      <span>Pipeline <strong>{status === "active" ? "MediaPipe" : "Waiting"}</strong></span>
      <span>Hand <strong>{hand ? hand.handedness : "Not detected"}</strong></span>
      <span>Gesture <strong>{gestureName}</strong></span>
      <span>Confidence <strong>{confidence}%</strong></span>
      <span>Latency <strong>{latency || "—"}{latency ? " ms" : ""}</strong></span>
    </div>
    <div className="gesture-command-panel"><div><Hand size={14}/><strong>{hand ? `${gestureName} recognized` : "Show one hand to begin"}</strong></div><span>Point: select forearm</span><span>Pinch: pick nearby tool</span><span>Move: position instrument</span><span>Open palm: release</span></div>
  </div>;
}
