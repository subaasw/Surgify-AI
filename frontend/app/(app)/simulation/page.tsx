"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { Activity, Camera, Check, Clock3, Crosshair, Focus, Hand, Layers3, Maximize2, MousePointer2, ScanLine, ShieldCheck, Sparkles, Stethoscope, Target } from "lucide-react";
import { SimulationTopbar } from "@/components/simulation/SimulationTopbar";
import { PatientPanel } from "@/components/simulation/PatientPanel";
import { ProcedurePanel } from "@/components/simulation/ProcedurePanel";
import { ToolBar } from "@/components/simulation/ToolBar";
import { HospitalScene } from "@/components/simulation/HospitalScene";
import { WebcamPractice } from "@/components/simulation/WebcamPractice";
import { useSimulation } from "@/components/simulation/SimulationProvider";
import { procedureSteps } from "@/data/simulationData";
import type { CameraMode } from "@/types/simulation";
import "./simulation.css";

export default function SimulationPage() {
  const { state, setCameraMode } = useSimulation();
  const objective = procedureSteps[state.currentStep];
  return <div className="simulation-page">
    <SimulationTopbar />
    <div className="simulation-body">
      <PatientPanel />
      <section className="simulation-center">
        <div className="simulation-viewport">
          {state.cameraMode === "webcam" ? <WebcamPractice /> : <HospitalScene />}
          <div className="viewport-top-left"><span><i />3D virtual patient</span><strong>{state.anatomyOverlay ? "Anatomy inspection" : "Clinical room · Bed 04"}</strong></div>
          {state.runStatus === "active" && <div className="objective-hud"><span className="objective-number">{state.currentStep + 1}</span><div><small>Current objective</small><strong>{objective.title}</strong><p>{objective.instruction}</p></div><b>{state.completedSteps.length}/{procedureSteps.length}</b></div>}
          <div className="view-preset-dock">{[["room", Camera, "Room overview"], ["patient", Focus, "Patient view"], ["closeup", Maximize2, "Right forearm"], ["tray", ScanLine, "Instrument tray"], ["anatomy", Layers3, "Anatomy inspection"]].map(([mode, Icon, label]) => { const I = Icon as typeof Camera; return <button key={mode as string} className={state.cameraMode === mode ? "active" : ""} onClick={() => setCameraMode(mode as CameraMode)} title={label as string}><I size={14} /><span>{label as string}</span></button>; })}</div>
          {state.selectedRegion && state.cameraMode !== "webcam" && <div className="selected-region-card"><span>Selected region</span><div><i><Crosshair size={15} /></i><strong>{state.selectedRegion}</strong><b>{state.selectedRegion === "Right arm" ? "Procedure site" : "Assessment region"}</b></div><p>{state.selectedRegion === "Right arm" ? "Use the current objective and highlighted toolbar category to continue." : "The reported injury is on the right forearm."}</p></div>}
          {state.completedSteps.includes("instruments") && state.cameraMode !== "webcam" && <SutureInteraction />}
          <div className="viewport-bottom-status"><span><MousePointer2 size={12} />Drag to orbit</span><span><ScanLine size={12} />Scroll to zoom</span><span className={state.anatomyOverlay ? "on" : ""}><Layers3 size={12} />Anatomy {state.anatomyOverlay ? "on" : "off"}</span><b>Educational simulation · No real-patient use</b></div>
        </div>
        <ToolBar />
      </section>
      <ProcedurePanel />
    </div>
    {state.runStatus === "ready" && <SimulationBriefing />}
    {state.paused && <div className="paused-overlay"><div><Activity size={24} /><strong>Simulation paused</strong><p>The timer and guided scenario are paused.</p></div></div>}
  </div>;
}

function SimulationBriefing() {
  const [input, setInput] = useState<"mouse" | "tracking">("mouse");
  const { startSimulation, toggleTracking } = useSimulation();
  const begin = () => { if (input === "tracking") toggleTracking(); startSimulation(); };
  return <div className="briefing-overlay"><section className="briefing-card" role="dialog" aria-modal="true" aria-labelledby="briefing-title"><div className="briefing-kicker"><span><Stethoscope size={15} /></span>Case SG-2048 · Bed 04</div><h1 id="briefing-title">Forearm Laceration</h1><p className="briefing-subtitle">Basic wound closure · Intermediate</p><div className="briefing-objective"><Target size={18} /><div><strong>Training objective</strong><p>Assess the patient, prepare a sterile field, select the correct instruments, and complete one guided interrupted stitch.</p></div></div><div className="briefing-facts"><span><Clock3 size={14} /><b>18 min</b> expected</span><span><ShieldCheck size={14} /><b>7 stages</b> guided</span><span><Sparkles size={14} /><b>Coach</b> enabled</span></div><fieldset className="input-choice"><legend>Choose input method</legend><button className={input === "mouse" ? "active" : ""} onClick={() => setInput("mouse")}><MousePointer2 size={18} /><span><strong>Mouse & touch</strong><small>Recommended for first attempt</small></span><Check size={15} /></button><button className={input === "tracking" ? "active" : ""} onClick={() => setInput("tracking")}><Hand size={18} /><span><strong>Hand tracking</strong><small>Requires camera and backend</small></span>{input === "tracking" && <Check size={15} />}</button></fieldset><button className="begin-simulation" onClick={begin}>Begin patient assessment</button><small className="briefing-disclaimer">Fictional patient · Educational simulation only · No camera video is stored</small></section></div>;
}

function SutureInteraction() {
  const { state, performAction, setSuturePosition, setSutureAngle } = useSimulation();
  const [dragging, setDragging] = useState(false);
  const router = useRouter();
  const track = useRef<HTMLDivElement>(null);
  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || !track.current) return;
    const rect = track.current.getBoundingClientRect();
    setSuturePosition(Math.max(4, Math.min(96, (event.clientX - rect.left) / rect.width * 100)));
  };
  const inPosition = state.suturePosition >= 43 && state.suturePosition <= 57;
  const goodAngle = state.sutureAngle >= 45 && state.sutureAngle <= 60;
  const actions = ["Position instrument", "Match angle", "Begin stitch", "Pull suture", "Tie knot", "Cut suture", "Finish procedure"];
  const nextAction = actions[state.stitchPhase];
  const ready = state.stitchPhase === 0 ? inPosition : state.stitchPhase === 1 ? goodAngle : true;
  const advance = () => { performAction(nextAction); if (nextAction === "Finish procedure") window.setTimeout(() => router.push("/results"), 250); };
  return <div className="suture-interaction"><div className="suture-hud-head"><div><Sparkles size={13} /><span>Guided closure</span></div><b>Phase {Math.min(state.stitchPhase + 1, 7)} / 7</b></div><div className="position-track" ref={track} onPointerMove={onMove} onPointerUp={() => setDragging(false)} onPointerLeave={() => setDragging(false)}><span className="position-entry"><Target size={12} /></span><i className={inPosition ? "ideal-position active" : "ideal-position"} /><button style={{ left: `${state.suturePosition}%` }} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }} aria-label="Drag needle holder to entry point"><MousePointer2 size={14} /></button></div><div className="angle-control"><div><span>Recommended angle</span><strong>45°–60°</strong></div><div><span>Current angle</span><strong className={goodAngle ? "good" : "warning"}>{state.sutureAngle}°</strong></div><input aria-label="Instrument angle" type="range" min="30" max="85" value={state.sutureAngle} onChange={event => setSutureAngle(Number(event.target.value))} /></div><div className="suture-readiness"><span className={inPosition ? "complete" : ""}>{inPosition ? <Check size={11} /> : <Crosshair size={11} />}Entry aligned</span><span className={goodAngle ? "complete" : ""}>{goodAngle ? <Check size={11} /> : <ScanLine size={11} />}Angle matched</span><span className={state.stitchPhase >= 3 ? "complete" : ""}>{state.stitchPhase >= 3 ? <Check size={11} /> : <ShieldCheck size={11} />}Guided arc</span></div><button className="advance-stitch" disabled={!ready || !state.selectedTool} onClick={advance}>{state.selectedTool ? nextAction : "Select needle holder first"}</button></div>;
}
