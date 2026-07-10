"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Crosshair, Eye, Scan, ShieldAlert, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export function WebcamSimulation({ overlays, guidance, running, action, warning }: {
  overlays: boolean;
  guidance: boolean;
  running: boolean;
  action: string;
  warning: string | null;
}) {
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const enableCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setCameraError(true); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setMode("live"); setCameraError(false);
    } catch {
      setCameraError(true); setMode("demo");
    }
  };

  const useDemo = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null; setMode("demo");
  };

  useEffect(() => () => streamRef.current?.getTracks().forEach(track => track.stop()), []);

  return (
    <div className="webcam-shell">
      <div className="webcam-topbar">
        <div className="feed-toggle" role="group" aria-label="Camera feed mode"><button className={mode === "demo" ? "active" : ""} onClick={useDemo}><Scan size={13} />Demo Feed</button><button className={mode === "live" ? "active" : ""} onClick={enableCamera}><Camera size={13} />Live Camera</button></div>
        <div className="tracking-state"><i className={running ? "running" : ""} /><span>{running ? "Tracking active" : "Tracking ready"}</span><Badge tone="green">96% confidence</Badge></div>
      </div>
      <div className="webcam-feed">
        {mode === "live" ? <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera feed" /> : <DemoPracticeScene running={running} overlays={overlays} />}
        {overlays && <TrackingOverlay running={running} />}
        <div className="camera-corner corner-tl" /><div className="camera-corner corner-tr" /><div className="camera-corner corner-bl" /><div className="camera-corner corner-br" />
        <div className="feed-hud top-left"><span><Eye size={12} />Tool detected</span><strong>Needle Holder</strong></div>
        <div className="feed-hud bottom-left"><span><Crosshair size={12} />Current action</span><strong>{action}</strong></div>
        <div className="feed-hud bottom-right"><span>Tracking confidence</span><strong className="text-success">96%</strong></div>
        {guidance && <div className="guide-callout"><Sparkles size={14} /><div><span>LIVE GUIDANCE</span><strong>Approach 4 mm closer to the entry marker</strong></div></div>}
        {warning && <div className="feed-warning"><ShieldAlert size={16} /><div><span>Movement alert</span><strong>{warning}</strong></div></div>}
        {cameraError && <div className="camera-fallback"><CameraOff size={20} /><strong>Camera unavailable</strong><span>Demo feed restored automatically.</span></div>}
      </div>
      <div className="feed-legend"><span><i className="cyan" />Tool path</span><span><i className="green" />Target zone</span><span><i className="red" />No-touch zone</span><span><i className="dot" />Hand landmarks</span><b>DEMO · NOT FOR CLINICAL USE</b></div>
    </div>
  );
}

function DemoPracticeScene({ running, overlays }: { running: boolean; overlays: boolean }) {
  return (
    <div className="demo-scene" aria-label="Simulated top-down suture practice pad">
      <div className="calibration-grid" />
      <span className="calibration-marker cm-1" /><span className="calibration-marker cm-2" /><span className="calibration-marker cm-3" /><span className="calibration-marker cm-4" />
      <div className="demo-hand hand-left"><i /><i /><i /><i /><b /></div>
      <div className="demo-hand hand-right"><i /><i /><i /><i /><b /></div>
      <div className="demo-pad">
        <div className="pad-texture" />
        <span className="pad-incision" />
        <span className="target-zone entry-zone"><b>ENTRY</b></span>
        <span className="target-zone exit-zone"><b>EXIT</b></span>
        <span className="no-touch-zone"><b>NO-TOUCH</b></span>
        <span className="ideal-guide" />
        {overlays && <span className={running ? "live-path moving" : "live-path"} />}
      </div>
      <div className={running ? "demo-tool active" : "demo-tool"}><span className="tool-ring top" /><span className="tool-ring bottom" /><b /><i /><em /></div>
    </div>
  );
}

function TrackingOverlay({ running }: { running: boolean }) {
  return (
    <div className="tracking-overlay" aria-hidden="true">
      <div className={running ? "tool-box active" : "tool-box"}><span>NEEDLE HOLDER · 0.96</span><i /></div>
      <div className="tool-tip-marker"><span />TIP</div>
      {[...Array(18)].map((_, i) => <i key={i} className={`landmark landmark-${i + 1}`} />)}
      <div className="safe-boundary" />
    </div>
  );
}
