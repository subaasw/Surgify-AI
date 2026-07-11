"use client";

import { Check, CircleDot, Eye, Focus, Hand, Layers3, MousePointer2, Move3d, ScanLine, Scissors, ShieldPlus, Sparkles, Stethoscope, Waves, Webcam, Crosshair } from "lucide-react";
import { useRouter } from "next/navigation";
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
const instruments = new Set(["Needle holder", "Forceps", "Scalpel", "Surgical scissors"]);

export function ToolBar() {
  const router = useRouter();
  const { state, selectRegion, selectTool, performAction, setCameraMode, toggleAnatomy, toggleTracking } = useSimulation();
  const actions: readonly string[] = state.currentStep <= 4 ? stepActions[state.currentStep]
    : state.currentStep === 5 ? ["Scalpel"]
    : state.currentStep === 6 ? [state.stitchPhase === 5 ? "Surgical scissors" : "Needle holder"]
    : ["Finish procedure"];
  const label = state.currentStep < 3 ? "Assessment" : state.currentStep === 3 ? "Sterile preparation" : state.currentStep === 4 ? "Instrument setup" : state.currentStep === 5 ? "Incision control" : state.currentStep === 6 ? "Closure tool" : "Final check";
  const choose = (item: string) => {
    if (item === "Select right forearm") selectRegion("Right arm");
    else if (instruments.has(item)) selectTool(item);
    else performAction(item);
    if (item === "Finish procedure") window.setTimeout(() => router.push("/results"), 250);
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
    <div className="tool-items">{actions.map(item => {
      const Icon = icons[item] ?? CircleDot;
      const selected = state.selectedTool === item || state.completedActions.includes(item) || (item === "Check allergies" && state.completedActions.includes("allergy")) || (item === "Select right forearm" && state.selectedRegion === "Right arm");
      return <button className={selected ? "selected" : ""} key={item} onClick={() => choose(item)}><span><Icon size={18} />{selected && <i />}</span><small>{item}</small></button>;
    })}</div>
    <div className="view-actions">{viewActions.map(([mode, label, Icon]) => <button key={mode} className={state.cameraMode === mode ? "active" : ""} onClick={() => setCameraMode(mode)} title={`${label} view`}><Icon size={15} /><span>{label}</span></button>)}<button className={state.anatomyOverlay ? "active" : ""} onClick={toggleAnatomy} title="Anatomy overlay"><Layers3 size={15} /><span>Anatomy</span></button><button className={state.trackingOverlay ? "active" : ""} onClick={toggleHands} title="Hand tracking"><Hand size={15} /><span>Hands</span></button><button className={state.cameraMode === "webcam" ? "active" : ""} onClick={showWebcam} title="Webcam practice"><Webcam size={15} /><span>Webcam</span></button></div>
    <div className="active-tool-slot"><span>Active tool</span><div><i>{state.selectedTool === "Surgical scissors" ? <Scissors size={16} /> : state.selectedTool === "Scalpel" ? <Crosshair size={16} /> : <MousePointer2 size={16} />}</i><strong>{state.selectedTool ?? "None"}</strong></div><small>{state.selectedTool ? "Visible at the procedure site" : "Choose the recommended action"}</small></div>
  </div>;
}
