"use client";

import { Check, CircleDot, Eye, Focus, Hand, Layers3, MousePointer2, Move3d, ScanLine, Scissors, ShieldPlus, Sparkles, Stethoscope, Waves, Webcam, Crosshair } from "lucide-react";
import { guidedCameraMode } from "@/lib/handPhysics.mjs";
import { useSimulation } from "./SimulationProvider";

const stepActions = [
  ["Check allergies", "Review patient information"],
  ["Inspect", "Select right forearm"],
  ["Check pulse", "Check sensation", "Check movement"],
  ["Gloves", "Antiseptic", "Sterile drape"],
  ["Needle holder", "Forceps"],
] as const;

const icons: Record<string, typeof Eye> = {
  "Check allergies": Stethoscope, "Review patient information": Check, Inspect: Eye,
  "Select right forearm": Crosshair,
  "Check pulse": Stethoscope, "Check sensation": Waves, "Check movement": Move3d,
  Gloves: ShieldPlus, Antiseptic: Sparkles, "Sterile drape": Layers3,
  "Needle holder": MousePointer2, Forceps: Focus, Scalpel: Crosshair, "Surgical scissors": Scissors,
  "Finish procedure": ShieldPlus,
};

const viewActions = [["room", "Room", Eye], ["patient", "Patient", Focus], ["closeup", "Close-up", ScanLine]] as const;
export function ToolBar() {
  const { state, selectRegion, performAction, setCameraMode, toggleAnatomy, toggleTracking } = useSimulation();
  const physicalStage = state.currentStep >= 4;
  const guidedStage = physicalStage && state.trackingOverlay;
  const heldTools = Object.values(state.heldTools).filter((tool): tool is string => Boolean(tool));
  const cameraAtField = guidedCameraMode(state.currentStep, state.stitchPhase, heldTools, state.trackingOverlay, state.cameraMode) === "closeup";
  const actions: readonly string[] = physicalStage ? [] : stepActions[state.currentStep];
  const label = state.currentStep < 3 ? "Assessment" : state.currentStep === 3 ? "Sterile preparation" : state.currentStep === 4 ? "Instrument setup" : state.currentStep === 5 ? "Nerve exposure" : state.currentStep === 6 ? "Nerve repair" : "Final check";
  const choose = (item: string) => {
    if (item === "Select right forearm") selectRegion("Right arm");
    else performAction(item);
  };
  const toggleHands = () => {
    if (state.trackingOverlay && state.cameraMode === "webcam") setCameraMode("room");
    toggleTracking();
  };
  const showWebcam = () => {
    if (!state.trackingOverlay) toggleTracking();
    setCameraMode("webcam");
  };

  return <div className="tool-bar contextual-toolbar">
    <div className="tool-context"><span>Recommended next</span><strong>{label}</strong><small>Only actions relevant to this stage are shown.</small></div>
    <div className="tool-items">{physicalStage && <div className="physical-tool-prompt"><Hand size={18}/><span><strong>{!state.trackingOverlay ? "Hand tracking required" : cameraAtField ? "Required tool secured — operative close-up" : "Guided instrument pickup"}</strong><small>{!state.trackingOverlay ? "Enable Hands to continue with direct projected-hand interaction." : cameraAtField ? "Keep pinching to hold the tool. The camera is locked on the surgical field." : "The camera is locked on the tray. Reach toward a handle and pinch to pick it up."}</small></span></div>}{actions.map(item => {
      const Icon = icons[item] ?? CircleDot;
      const selected = state.selectedTool === item || state.completedActions.includes(item) || (item === "Check allergies" && state.completedActions.includes("allergy")) || (item === "Select right forearm" && state.selectedRegion === "Right arm");
      return <button className={selected ? "selected" : ""} key={item} onClick={() => choose(item)}><span><Icon size={18} />{selected && <i />}</span><small>{item}</small></button>;
    })}</div>
    <div className="view-actions">{viewActions.map(([mode, label, Icon]) => <button key={mode} disabled={guidedStage} className={state.cameraMode === mode ? "active" : ""} onClick={() => setCameraMode(mode)} title={guidedStage ? "Camera is guided during surgery" : `${label} view`}><Icon size={15} /><span>{label}</span></button>)}<button className={state.anatomyOverlay ? "active" : ""} onClick={toggleAnatomy} title="Anatomy overlay"><Layers3 size={15} /><span>Anatomy</span></button><button className={state.trackingOverlay ? "active" : ""} onClick={toggleHands} title="Hand tracking"><Hand size={15} /><span>Hands</span></button><button disabled={guidedStage} className={state.cameraMode === "webcam" ? "active" : ""} onClick={showWebcam} title={guidedStage ? "Camera is guided during surgery" : "Webcam practice"}><Webcam size={15} /><span>Webcam</span></button></div>
    <div className="active-tool-slot"><span>Held tool</span><div><i>{state.selectedTool === "Surgical scissors" ? <Scissors size={16} /> : state.selectedTool === "Scalpel" ? <Crosshair size={16} /> : <Hand size={16} />}</i><strong>{Object.values(state.heldTools).find(Boolean) ?? "None"}</strong></div><small>{(Object.entries(state.heldTools) as [string,string|null][]).find(([,tool])=>tool)?.[0] ? `${(Object.entries(state.heldTools) as [string,string|null][]).find(([,tool])=>tool)?.[0]} hand` : "Pinch a tray instrument"}</small></div>
  </div>;
}
