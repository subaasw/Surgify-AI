"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Activity, Check, Clock3, Crosshair, Hand, Layers3, MousePointer2, ScanLine, ShieldCheck, Sparkles, Stethoscope, Target } from "lucide-react";
import { SimulationTopbar } from "@/components/simulation/SimulationTopbar";
import { PatientPanel } from "@/components/simulation/PatientPanel";
import { ProcedurePanel } from "@/components/simulation/ProcedurePanel";
import { ToolBar } from "@/components/simulation/ToolBar";
import { HospitalScene } from "@/components/simulation/HospitalScene";
import { useSimulation } from "@/components/simulation/SimulationProvider";
import { procedureSteps, stitchPhaseLabels } from "@/data/simulationData";
import { INCISION_SEGMENTS } from "@/lib/handPhysics.mjs";
import "./simulation.css";

export default function SimulationPage() {
  const { state } = useSimulation();
  const router = useRouter();
  const objective = procedureSteps[state.currentStep];
  const handsOn = state.currentStep >= 5;
  useEffect(() => { if (state.runStatus === "complete") router.push("/results"); }, [router, state.runStatus]);
  return <div className={`simulation-page${handsOn ? " procedure-focus" : ""}${state.trackingOverlay ? " hand-control-mode" : ""}${state.runStatus === "ready" ? " briefing-open" : ""}`}>
    <SimulationTopbar />
    <div className="simulation-body">
      <PatientPanel />
      <section className="simulation-center">
        <div className="simulation-viewport">
          <HospitalScene />
          <div className="viewport-top-left"><span><i />{state.cameraMode === "webcam" ? "Live hand practice" : "3D layered patient"}</span><strong>{state.cameraMode === "webcam" ? "Camera workspace · Pinch controls enabled" : state.anatomyOverlay ? "Layered anatomy inspection" : handsOn ? "Procedure close-up · Virtual forearm" : "Clinical room · Bed 04"}</strong></div>
          {state.runStatus === "active" && <div className="objective-hud"><span className="objective-number">{state.currentStep + 1}</span><div><small>{handsOn ? "Hands-on phase" : "Current objective"}</small><strong>{objective.title}</strong><p>{objective.instruction}</p></div><b>{state.completedSteps.length}/{procedureSteps.length}</b></div>}
          {state.anatomyOverlay && <div className="patient-layer-hud"><strong>Patient layers</strong><span><i className="skin" />Skin</span><span><i className="muscle" />Muscle</span><span><i className="bone" />Skeleton</span><span><i className="vascular" />Vessels</span><span><i className="nerve" />Nerves</span></div>}
          {state.selectedRegion && !handsOn && state.cameraMode !== "webcam" && <div className="selected-region-card"><span>Selected region</span><div><i><Crosshair size={15} /></i><strong>{state.selectedRegion}</strong><b>{state.selectedRegion === "Right arm" ? "Procedure site" : "Assessment region"}</b></div><p>{state.selectedRegion === "Right arm" ? "The virtual forearm is ready for the guided workflow." : "The reported injury is on the right forearm."}</p></div>}
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
  const { state, startSimulation, toggleTracking, setUiCollapsed } = useSimulation();
  const begin = () => {
    if (!state.trackingOverlay) toggleTracking();
    setUiCollapsed(true);
    startSimulation();
  };
  return <div className="briefing-overlay"><section className="briefing-card" role="dialog" aria-modal="true" aria-labelledby="briefing-title"><div className="briefing-kicker"><span><Stethoscope size={15} /></span>Case SG-2048 · Bed 04</div><h1 id="briefing-title">Forearm Nerve Repair</h1><p className="briefing-subtitle">Assessment, nerve exposure, approximation, and guided microsuture repair</p><div className="briefing-objective"><Target size={18} /><div><strong>Training objective</strong><p>Follow the clinical sequence, expose the divided nerve directly on the layered patient, align its ends, and complete a guided repair.</p></div></div><div className="briefing-facts"><span><Clock3 size={14} /><b>18 min</b> expected</span><span><ShieldCheck size={14} /><b>8 stages</b> guided</span><span><Sparkles size={14} /><b>Coach</b> enabled</span></div><fieldset className="input-choice"><legend>Required control mode</legend><button className="active" type="button"><Hand size={18} /><span><strong>Projected-hand control</strong><small>Pinch to grab; real hand and tool contact drive every surgical change</small></span><Check size={15} /></button></fieldset><button className="begin-simulation" onClick={begin}>Enable camera and begin</button><small className="briefing-disclaimer">Fictional layered patient · Educational simulation · No camera video is stored</small></section></div>;
}

function IncisionInteraction() {
  const { state } = useSimulation();
  const hand = (Object.entries(state.heldTools) as ["Left" | "Right", string | null][]).find(([, tool]) => tool === "Scalpel")?.[0];
  return <div className="procedure-console">
    <header><div><Crosshair size={14} /><span>Live incision contact</span></div><b>{state.surfaceContact ? "CONTACT" : "READY"}</b></header>
    <p className="console-instruction">{hand ? `Scalpel held by ${hand} hand. Touch the first marker, press gently, and trace toward the final marker.` : "Pinch the scalpel handle on the instrument tray. Cutting is disabled until the tool is physically held."}</p>
    <div className="motion-progress"><span style={{ width: `${state.incisionProgress * 100}%` }} /><i>{state.incisionComplete ? "Nerve exposed" : `${state.incisionSegments.length}/${INCISION_SEGMENTS} incision contacts`}</i></div>
    <div className="console-metrics"><span className={hand ? "good" : ""}><small>Instrument</small><strong>{hand ? "Held" : "Pick up"}</strong></span><span className={state.surfaceContact ? "good" : ""}><small>Blade tip</small><strong>{state.surfaceContact ? "On guide" : "Off surface"}</strong></span><span><small>Depth</small><strong>{Math.round(state.incisionDepth * 1000)} mm</strong></span></div>
  </div>;
}

function SutureInteraction() {
  const { state } = useSimulation();
  const finalReview = state.currentStep === 7;
  const phaseLabel = finalReview ? "Review nerve repair" : stitchPhaseLabels[state.stitchPhase];
  const inPosition = state.suturePosition >= 43 && state.suturePosition <= 57;
  const goodAngle = state.sutureAngle >= 45 && state.sutureAngle <= 60;
  const requiredTool = finalReview ? "Free hands + thumbs up" : state.stitchPhase === 0 ? "Forceps" : state.stitchPhase === 4 ? "Needle holder + forceps" : state.stitchPhase === 5 ? "Surgical scissors" : "Needle holder";
  const held = Object.values(state.heldTools).filter(Boolean).join(" + ") || "None";
  return <div className="procedure-console">
    <header><div><Sparkles size={14} /><span>Direct nerve repair</span></div><b>{state.surfaceContact ? "SURFACE CONTACT" : "HAND CONTROL"}</b></header>
    <div className="phase-title"><span>{finalReview ? <ShieldCheck size={15} /> : <Target size={15} />}</span><div><small>Current phase</small><strong>{phaseLabel}</strong></div></div>
    <p className="console-instruction">{finalReview ? "Release both instruments, then hold a thumbs-up gesture to approve the completed repair." : `Pick up ${requiredTool.toLowerCase()} and perform the movement over the highlighted tissue target.`}</p>
    {!finalReview && state.stitchPhase >= 2 && <div className="motion-progress"><span style={{ width: `${state.stitchProgress * 100}%` }} /><i>{Math.round(state.stitchProgress * 100)}% movement captured</i></div>}
    <div className="console-metrics"><span className={held !== "None" ? "good" : ""}><small>Held tools</small><strong>{held}</strong></span><span className={inPosition ? "good" : ""}><small>Nerve ends</small><strong>{inPosition ? "Aligned" : "Open"}</strong></span><span className={goodAngle ? "good" : ""}><small>Live angle</small><strong>{goodAngle ? `${state.sutureAngle}° safe` : `${state.sutureAngle}°`}</strong></span></div>
  </div>;
}
