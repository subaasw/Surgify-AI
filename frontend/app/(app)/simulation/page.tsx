"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { Activity, Check, Clock3, Crosshair, Hand, Layers3, MousePointer2, ScanLine, ShieldCheck, Sparkles, Stethoscope, Target } from "lucide-react";
import { SimulationTopbar } from "@/components/simulation/SimulationTopbar";
import { PatientPanel } from "@/components/simulation/PatientPanel";
import { ProcedurePanel } from "@/components/simulation/ProcedurePanel";
import { ToolBar } from "@/components/simulation/ToolBar";
import { HospitalScene } from "@/components/simulation/HospitalScene";
import { WebcamPractice } from "@/components/simulation/WebcamPractice";
import { useSimulation } from "@/components/simulation/SimulationProvider";
import { useSurgicalAudio } from "@/components/simulation/SurgicalAudio";
import { procedureSteps, stitchActions, stitchPhaseLabels } from "@/data/simulationData";
import "./simulation.css";

export default function SimulationPage() {
  const { state } = useSimulation();
  const objective = procedureSteps[state.currentStep];
  const handsOn = state.currentStep >= 5;
  return <div className={`simulation-page${handsOn ? " procedure-focus" : ""}`}>
    <SimulationTopbar />
    <div className="simulation-body">
      <PatientPanel />
      <section className="simulation-center">
        <div className="simulation-viewport">
          <HospitalScene />
          {state.cameraMode === "webcam" && <WebcamPractice />}
          <div className="viewport-top-left"><span><i />3D virtual patient</span><strong>{state.anatomyOverlay ? "Anatomy inspection" : handsOn ? "Procedure close-up · Synthetic pad" : "Clinical room · Bed 04"}</strong></div>
          {state.runStatus === "active" && <div className="objective-hud"><span className="objective-number">{state.currentStep + 1}</span><div><small>{handsOn ? "Hands-on phase" : "Current objective"}</small><strong>{objective.title}</strong><p>{objective.instruction}</p></div><b>{state.completedSteps.length}/{procedureSteps.length}</b></div>}
          {state.selectedRegion && !handsOn && state.cameraMode !== "webcam" && <div className="selected-region-card"><span>Selected region</span><div><i><Crosshair size={15} /></i><strong>{state.selectedRegion}</strong><b>{state.selectedRegion === "Right arm" ? "Procedure site" : "Assessment region"}</b></div><p>{state.selectedRegion === "Right arm" ? "The synthetic practice pad is ready for the guided workflow." : "The reported injury is on the right forearm."}</p></div>}
          {state.currentStep === 5 && state.cameraMode !== "webcam" && <IncisionInteraction />}
          {state.currentStep >= 6 && state.cameraMode !== "webcam" && <SutureInteraction />}
          {!handsOn && <div className="viewport-bottom-status"><span><MousePointer2 size={12} />Drag to orbit</span><span><ScanLine size={12} />Scroll to zoom</span><span className={state.anatomyOverlay ? "on" : ""}><Layers3 size={12} />Anatomy {state.anatomyOverlay ? "on" : "off"}</span><b>Educational simulation · No real-patient use</b></div>}
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
  const { startSimulation, setCameraMode, toggleTracking } = useSimulation();
  const begin = () => {
    if (input === "tracking") { setCameraMode("webcam"); toggleTracking(); }
    startSimulation();
  };
  return <div className="briefing-overlay"><section className="briefing-card" role="dialog" aria-modal="true" aria-labelledby="briefing-title"><div className="briefing-kicker"><span><Stethoscope size={15} /></span>Case SG-2048 · Bed 04</div><h1 id="briefing-title">Forearm Laceration</h1><p className="briefing-subtitle">Assessment, synthetic incision control, and one interrupted suture</p><div className="briefing-objective"><Target size={18} /><div><strong>Training objective</strong><p>Follow the clinical sequence, then complete a guided incision and closure exercise on the attached synthetic pad.</p></div></div><div className="briefing-facts"><span><Clock3 size={14} /><b>18 min</b> expected</span><span><ShieldCheck size={14} /><b>8 stages</b> guided</span><span><Sparkles size={14} /><b>Coach</b> enabled</span></div><fieldset className="input-choice"><legend>Choose input method</legend><button className={input === "mouse" ? "active" : ""} onClick={() => setInput("mouse")}><MousePointer2 size={18} /><span><strong>Mouse & touch</strong><small>Recommended for the first attempt</small></span>{input === "mouse" && <Check size={15} />}</button><button className={input === "tracking" ? "active" : ""} onClick={() => setInput("tracking")}><Hand size={18} /><span><strong>Hand tracking</strong><small>Camera-based first-person control</small></span>{input === "tracking" && <Check size={15} />}</button></fieldset><button className="begin-simulation" onClick={begin}>Begin patient assessment</button><small className="briefing-disclaimer">Fictional patient · Synthetic procedure pad · No camera video is stored</small></section></div>;
}

function IncisionInteraction() {
  const { state, performAction, setIncisionProgress } = useSimulation();
  const audio = useSurgicalAudio();
  const [dragging, setDragging] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const hasBegun = state.completedActions.includes("Begin incision");
  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || !track.current) return;
    const rect = track.current.getBoundingClientRect();
    setIncisionProgress(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)));
  };
  const stop = () => { setDragging(false); audio.stopIncision(); };
  return <div className="procedure-console">
    <header><div><Crosshair size={14} /><span>Practice incision</span></div><b>Cut control</b></header>
    <p className="console-instruction">{hasBegun ? "Press and drag the scalpel through the complete guide at one steady pace." : "Select the scalpel, then begin when the synthetic pad is centered."}</p>
    {hasBegun && <div className="incision-track" ref={track} onPointerMove={onMove} onPointerUp={stop} onPointerCancel={stop} onPointerLeave={() => dragging && stop()}><i /><span style={{ width: `${state.incisionProgress * 100}%` }} /><button style={{ left: `${state.incisionProgress * 100}%` }} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); audio.playIncision(); }} aria-label="Drag the scalpel along the incision guide"><MousePointer2 size={15} /></button></div>}
    <div className="console-metrics"><span><small>Path coverage</small><strong>{Math.round(state.incisionProgress * 100)}%</strong></span><span><small>Surface</small><strong>Synthetic pad</strong></span><span className={state.incisionProgress >= .95 ? "good" : ""}><small>Control</small><strong>{state.incisionProgress >= .95 ? "Complete" : "In progress"}</strong></span></div>
    {!hasBegun ? <button className="console-primary" disabled={state.selectedTool !== "Scalpel"} onClick={() => performAction("Begin incision")}>{state.selectedTool === "Scalpel" ? "Begin controlled incision" : "Select scalpel below"}</button> : <button className="console-primary" disabled={state.incisionProgress < .95} onClick={() => { audio.stopIncision(); performAction("Complete incision"); }}>Confirm incision</button>}
  </div>;
}

function SutureInteraction() {
  const { state, performAction, setSuturePosition, setSutureAngle, setStitchProgress } = useSimulation();
  const audio = useSurgicalAudio();
  const router = useRouter();
  const track = useRef<HTMLDivElement>(null);
  const animation = useRef<number>(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => cancelAnimationFrame(animation.current), []);
  const finalReview = state.currentStep === 7;
  const nextAction = finalReview ? "Finish procedure" : stitchActions[state.stitchPhase] ?? "Finish procedure";
  const phaseLabel = finalReview ? "Review stitch" : stitchPhaseLabels[state.stitchPhase];
  const inPosition = state.suturePosition >= 43 && state.suturePosition <= 57;
  const goodAngle = state.sutureAngle >= 45 && state.sutureAngle <= 60;
  const requiredTool = state.stitchPhase === 5 ? "Surgical scissors" : "Needle holder";
  const toolReady = finalReview || state.selectedTool === requiredTool;
  const ready = !busy && toolReady && (state.stitchPhase !== 0 || inPosition) && (state.stitchPhase !== 1 || goodAngle);
  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || !track.current) return;
    const rect = track.current.getBoundingClientRect();
    setSuturePosition(Math.max(4, Math.min(96, (event.clientX - rect.left) / rect.width * 100)));
  };
  const animate = (duration: number, done: () => void) => {
    setBusy(true); setStitchProgress(0);
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      setStitchProgress(progress);
      if (progress < 1) animation.current = requestAnimationFrame(tick);
      else { setBusy(false); done(); }
    };
    animation.current = requestAnimationFrame(tick);
  };
  const advance = () => {
    if (nextAction === "Finish procedure") { performAction(nextAction); window.setTimeout(() => router.push("/results"), 250); return; }
    if (nextAction === "Position instrument" || nextAction === "Match angle") { performAction(nextAction); return; }
    if (nextAction === "Begin stitch") audio.playPierce();
    if (nextAction === "Pull suture") audio.playPull();
    if (nextAction === "Tie knot") audio.playKnot();
    if (nextAction === "Cut suture") audio.playSnip();
    animate(nextAction === "Begin stitch" ? 1250 : nextAction === "Pull suture" ? 950 : 650, () => performAction(nextAction));
  };
  return <div className="procedure-console">
    <header><div><Sparkles size={14} /><span>Interrupted suture</span></div><b>{finalReview ? "Final review" : `${state.stitchPhase + 1} / ${stitchActions.length}`}</b></header>
    <div className="phase-title"><span>{finalReview ? <ShieldCheck size={15} /> : <Target size={15} />}</span><div><small>Current phase</small><strong>{phaseLabel}</strong></div></div>
    {!finalReview && state.stitchPhase === 0 && <div className="position-track" ref={track} onPointerMove={onMove} onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}><span className="position-entry"><Target size={12} /></span><i className={inPosition ? "ideal-position active" : "ideal-position"} /><button style={{ left: `${state.suturePosition}%` }} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }} aria-label="Drag the needle holder to the entry zone"><MousePointer2 size={14} /></button></div>}
    {!finalReview && state.stitchPhase === 1 && <div className="angle-control"><div><span>Target approach</span><strong>45°–60°</strong></div><div><span>Current angle</span><strong className={goodAngle ? "good" : "warning"}>{state.sutureAngle}°</strong></div><input aria-label="Instrument angle" type="range" min="30" max="85" value={state.sutureAngle} onChange={event => setSutureAngle(Number(event.target.value))} /></div>}
    {!finalReview && state.stitchPhase >= 2 && <div className="motion-progress"><span style={{ width: `${busy ? state.stitchProgress * 100 : state.stitchPhase > 2 ? 100 : 0}%` }} /><i>{busy ? `${Math.round(state.stitchProgress * 100)}%` : nextAction}</i></div>}
    <div className="console-metrics"><span className={inPosition ? "good" : ""}><small>Entry</small><strong>{inPosition ? "Aligned" : "Adjust"}</strong></span><span className={goodAngle ? "good" : ""}><small>Angle</small><strong>{goodAngle ? "Safe" : `${state.sutureAngle}°`}</strong></span><span className={state.stitchPhase >= 5 ? "good" : ""}><small>Knot</small><strong>{state.stitchPhase >= 5 ? "Secure" : "Pending"}</strong></span></div>
    <button className="console-primary" disabled={!ready} onClick={advance}>{busy ? "Movement in progress…" : !toolReady ? `Select ${requiredTool.toLowerCase()} below` : finalReview ? "Complete simulation" : nextAction}</button>
  </div>;
}
