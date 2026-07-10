"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/ui/Brand";
import { Badge } from "@/components/ui/Badge";
import { ProcedureSteps, procedureSteps } from "./ProcedureSteps";
import { WebcamSimulation } from "./WebcamSimulation";
import { LiveMetrics, type LiveMetricValues } from "./LiveMetrics";
import { SessionControls } from "./SessionControls";
import { CalibrationModal } from "./CalibrationModal";
import { medicalDisclaimer } from "@/data/mockData";

export function TrainingSession() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [overlays, setOverlays] = useState(true);
  const [guidance, setGuidance] = useState(true);
  const [calibrating, setCalibrating] = useState(false);
  const [tick, setTick] = useState(0);
  const activeStep = Math.min(Math.floor(seconds / 12), procedureSteps.length - 1);
  const warnings = [null, null, "Excessive movement detected", null, "Incorrect tool angle", null, null, "Safety zone entered"];
  const warning = running && seconds > 3 ? warnings[Math.floor(seconds / 7) % warnings.length] : null;
  const coachIndex = Math.floor(seconds / 8) % 4;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => { setSeconds(s => s + 1); setTick(t => t + 1); }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const metrics: LiveMetricValues = useMemo(() => ({
    accuracy: Math.max(74, Math.min(92, 84 + Math.sin(tick * .7) * 4)),
    efficiency: Math.max(68, Math.min(88, 76 + Math.cos(tick * .55) * 5)),
    stability: Math.max(72, Math.min(91, 81 + Math.sin(tick * .4 + 1) * 4)),
    safety: warning ? 84 : 92 + Math.sin(tick * .25) * 2,
    score: warning ? 78 + Math.sin(tick) : 82 + Math.sin(tick * .35) * 3,
  }), [tick, warning]);

  const start = () => { setStarted(true); setRunning(true); };
  const restart = () => { setRunning(false); setStarted(false); setSeconds(0); setTick(0); };
  const end = () => {
    setRunning(false);
    // Replace this mock persistence with a session API when a real analytics backend is connected.
    try {
      localStorage.setItem("surgify:lastScenario", "suture");
      localStorage.setItem("surgify:personalBest", "86");
      localStorage.setItem("surgify:streak", "7");
      localStorage.setItem("surgify:completedSessions", "25");
    } catch { /* Prototype remains functional without storage access. */ }
    router.push("/results");
  };

  const action = ["Aligning needle", "Approaching entry zone", "Entering target zone", "Following needle arc"][coachIndex];
  return (
    <div className="training-session-page">
      <header className="session-header"><Brand href="/dashboard" /><div className="session-breadcrumb"><span>Training</span><b>/</b><strong>Simple Interrupted Suture</strong></div><div className="session-header-status"><Badge tone="amber">Educational simulation</Badge><span><i /> System ready</span></div></header>
      <div className="training-workspace"><ProcedureSteps activeStep={activeStep} seconds={seconds} running={running} /><section className="session-center"><WebcamSimulation overlays={overlays} guidance={guidance} running={running} action={action} warning={warning} /><SessionControls running={running} started={started} overlays={overlays} guidance={guidance} onStart={start} onPause={() => setRunning(false)} onRestart={restart} onEnd={end} onToggleOverlays={() => setOverlays(!overlays)} onToggleGuidance={() => setGuidance(!guidance)} onCalibrate={() => setCalibrating(true)} /><p className="session-disclaimer">{medicalDisclaimer}</p></section><LiveMetrics metrics={metrics} coachIndex={coachIndex} warning={warning} /></div>
      <CalibrationModal open={calibrating} onClose={() => setCalibrating(false)} />
    </div>
  );
}
