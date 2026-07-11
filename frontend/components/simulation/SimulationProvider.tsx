"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { CameraMode, CoachMessage, SimulationState } from "@/types/simulation";
import { procedureSteps, stitchActions } from "@/data/simulationData";

const createInitialState = (): SimulationState => ({
  runStatus: "ready",
  selectedRegion: null,
  selectedTool: null,
  currentStep: 0,
  completedSteps: [],
  completedActions: [],
  cameraMode: "room",
  paused: false,
  elapsedTime: 0,
  score: 100,
  vitals: { heartRate: 88, systolic: 122, diastolic: 78, oxygenSaturation: 98, respiratoryRate: 16, temperature: 36.8 },
  feedback: [{ id: "ready", tone: "info", title: "Case briefing ready", message: "Review the objective and choose an input method to begin.", timestamp: 0 }],
  anatomyOverlay: false,
  trackingOverlay: false, // POV hands off by default
  events: [],
  uiCollapsed: false,

  // Incision state
  incisionProgress: 0,
  incisionComplete: false,

  // Suture state
  stitchPhase: 0,
  stitchProgress: 0,
  suturePosition: 22,
  sutureAngle: 68,
});

type SimulationContextValue = {
  state: SimulationState;
  startSimulation: () => void;
  selectRegion: (region: string) => void;
  selectTool: (tool: string) => void;
  releaseTool: () => void;
  performAction: (action: string) => void;
  setCameraMode: (mode: CameraMode) => void;
  setPaused: (paused: boolean) => void;
  setSuturePosition: (position: number) => void;
  setSutureAngle: (angle: number) => void;
  setIncisionProgress: (progress: number) => void;
  setStitchProgress: (progress: number) => void;
  resetSimulation: () => void;
  toggleAnatomy: () => void;
  toggleTracking: () => void;
  setUiCollapsed: (collapsed: boolean) => void;
};

const SimulationContext = createContext<SimulationContextValue | null>(null);
const stepIndex = (id: string) => procedureSteps.findIndex(step => step.id === id);
const addAction = (actions: string[], action: string) => [...new Set([...actions, action])];

function addFeedback(current: SimulationState, title: string, message: string, tone: CoachMessage["tone"] = "info", scoreDelta = 0): SimulationState {
  const id = `${Date.now()}-${title}`;
  return {
    ...current,
    score: Math.max(0, Math.min(100, current.score + scoreDelta)),
    feedback: [{ id, title, message, tone, timestamp: current.elapsedTime }, ...current.feedback].slice(0, 10),
    events: [...current.events, { id, timestamp: current.elapsedTime, tone, label: title }],
  };
}

function completeCurrentStep(current: SimulationState, id: string, message: string): SimulationState {
  const index = stepIndex(id);
  if (index !== current.currentStep) {
    return addFeedback(current, "Complete the current objective first", `Finish "${procedureSteps[current.currentStep].title}" before moving ahead.`, "warning", -2);
  }
  const completedSteps = addAction(current.completedSteps, id);
  const next = procedureSteps.findIndex(step => !completedSteps.includes(step.id));
  const nextStep = next < 0 ? procedureSteps.length - 1 : next;

  let nextCameraMode = current.cameraMode;
  let nextUiCollapsed = current.uiCollapsed;
  if (nextStep === 4) nextCameraMode = "tray";
  if (nextStep >= 5 && nextStep <= 6) {
     nextCameraMode = "closeup";
     nextUiCollapsed = true;
  }
  if (nextStep === 7) {
     nextCameraMode = "room";
     nextUiCollapsed = false;
  }

  return addFeedback({ ...current, completedSteps, currentStep: nextStep, cameraMode: nextCameraMode, uiCollapsed: nextUiCollapsed }, "Objective completed", message, "success");
}

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SimulationState>(createInitialState);
  const pathname = usePathname();

  useEffect(() => {
    try {
      const preferences = JSON.parse(localStorage.getItem("surgify:simulation-preferences") ?? "{}");
      for (const [key, value] of Object.entries(preferences)) document.documentElement.dataset[key] = String(value);
    } catch { /* preferences are optional */ }
  }, []);

  useEffect(() => {
    if (pathname !== "/simulation" || state.runStatus !== "active" || state.paused) return;
    const timer = window.setInterval(() => setState(current => {
      const pulse = Math.round(Math.sin(current.elapsedTime / 8));
      return { ...current, elapsedTime: current.elapsedTime + 1, vitals: { ...current.vitals, heartRate: 88 + pulse, oxygenSaturation: current.elapsedTime % 17 === 0 ? 97 : 98, respiratoryRate: 16 + (current.elapsedTime % 20 === 0 ? 1 : 0) } };
    }), 1000);
    return () => clearInterval(timer);
  }, [pathname, state.runStatus, state.paused]);

  const startSimulation = useCallback(() => setState(current => current.runStatus === "ready"
    ? addFeedback({ ...current, runStatus: "active" }, "Simulation started", "Confirm identity and allergy status before examining the injury.", "info")
    : current), []);

  const selectRegion = useCallback((region: string) => setState(current => {
    if (current.runStatus !== "active") return current;
    const selected = { ...current, selectedRegion: region, cameraMode: region === "Right arm" ? "closeup" as const : "patient" as const };
    if (region !== "Right arm") return addFeedback(selected, `${region} selected`, "The case history identifies the right forearm. Reassess the reported pain location.", "warning", -2);
    if (current.currentStep === 1) return completeCurrentStep(selected, "identify", "Right forearm selected and the synthetic wound patch identified.");
    if (current.currentStep < 1) return addFeedback(selected, "Correct site found early", "Finish the patient review before examining the injury.", "warning", -1);
    return addFeedback(selected, "Right forearm focused", "The procedure site is in view.", "info");
  }), []);

  const selectTool = useCallback((tool: string) => setState(current => {
    if (current.runStatus !== "active") return current;
    const selected = { ...current, selectedTool: tool };

    // Scalpel selection during incision step
    if (tool === "Scalpel") {
      if (current.currentStep !== 5) return addFeedback(selected, "Scalpel not needed yet", `Finish "${procedureSteps[current.currentStep].title}" first.`, "warning", -1);
      return addFeedback(selected, "Scalpel ready", "Trace along the marked incision line to make the cut.", "info");
    }

    if (current.currentStep > 4) return addFeedback(selected, `${tool} active`, tool === "Needle holder" ? "Needle holder ready for guided closure." : "Tool placed in the active slot.", "info");
    if (current.currentStep !== 4) return addFeedback(selected, "Instrument selected early", `Finish "${procedureSteps[current.currentStep].title}" before instrument setup.`, "warning", -1);
    if (!['Needle holder','Forceps'].includes(tool)) return addFeedback(selected, "Instrument not required", "This exercise requires a needle holder and forceps.", "warning", -2);
    const completedActions = addAction(current.completedActions, tool);
    const ready = completedActions.includes("Needle holder") && completedActions.includes("Forceps");
    const next = { ...selected, selectedTool: ready ? "Needle holder" : tool, completedActions };
    return ready
      ? completeCurrentStep(next, "instruments", "Needle holder and forceps confirmed. The needle holder is active for closure.")
      : addFeedback(next, `${tool} confirmed`, `Now select ${tool === "Needle holder" ? "forceps" : "the needle holder"}.`, "success");
  }), []);

  const releaseTool = useCallback(() => setState(current => addFeedback({ ...current, selectedTool: null }, "Tool returned", "The active instrument was returned to the tray.", "info")), []);

  const performAction = useCallback((action: string) => setState(current => {
    if (current.runStatus !== "active" || current.paused) return current;

    if (action === "Check allergies") {
      return addFeedback({ ...current, completedActions: addAction(current.completedActions, "allergy") }, "Allergy status checked", "Alex reports no known medication or latex allergies.", "success");
    }

    if (action === "Review patient information") {
      if (current.currentStep !== 0) return addFeedback(current, "Patient review already complete", "Continue with the current objective.", "info");
      if (!current.completedActions.includes("allergy")) return addFeedback(current, "Allergy status required", "Ask the patient about allergies before confirming the review.", "warning");
      return completeCurrentStep({ ...current, completedActions: addAction(current.completedActions, action) }, "review", "Identity, complaint, mechanism, and allergy status confirmed.");
    }

    const assessmentActions = ["Check pulse", "Check sensation", "Check movement"];
    if (assessmentActions.includes(action)) {
      if (current.currentStep !== 2) return addFeedback(current, "Assessment out of sequence", `Finish "${procedureSteps[current.currentStep].title}" first.`, "warning", -1);
      const completedActions = addAction(current.completedActions, action);
      const ready = assessmentActions.every(item => completedActions.includes(item));
      const next = { ...current, completedActions };
      if (ready) return completeCurrentStep(next, "assess", "Distal pulse, sensation, and finger movement are intact.");
      return addFeedback(next, action, `${assessmentActions.filter(item => !completedActions.includes(item)).length} assessment check${assessmentActions.filter(item => !completedActions.includes(item)).length === 1 ? "" : "s"} remaining.`, "success");
    }

    const preparationActions = ["Gloves", "Antiseptic", "Sterile drape"];
    if ([...preparationActions, "Gauze", "Clean wound", "Local anaesthetic simulation"].includes(action)) {
      if (current.currentStep !== 3) return addFeedback(current, "Preparation out of sequence", `Finish "${procedureSteps[current.currentStep].title}" first.`, "warning", -1);
      const completedActions = addAction(current.completedActions, action);
      const ready = preparationActions.every(item => completedActions.includes(item));
      const next = { ...current, completedActions };
      if (ready) return completeCurrentStep(next, "prepare", "Gloves applied, synthetic surface cleansed, and sterile field established.");
      return addFeedback(next, action, `${preparationActions.filter(item => !completedActions.includes(item)).length} required preparation item${preparationActions.filter(item => !completedActions.includes(item)).length === 1 ? "" : "s"} remaining.`, "success");
    }

    // ── Incision actions ──
    const incisionActions = ["Begin incision", "Complete incision"];
    if (incisionActions.includes(action)) {
      if (current.currentStep !== 5) return addFeedback(current, "Incision not ready", `Finish "${procedureSteps[current.currentStep].title}" first.`, "warning", -2);
      if (current.selectedTool !== "Scalpel") return addFeedback(current, "Scalpel required", "Select the scalpel before making the incision.", "error", -2);

      if (action === "Begin incision") {
        return addFeedback(
          { ...current, completedActions: addAction(current.completedActions, action) },
          "Incision started", "Trace along the marked line. Maintain even depth and speed.", "info"
        );
      }

      if (action === "Complete incision") {
        if (current.incisionProgress < 0.85) return addFeedback(current, "Incision incomplete", "Continue tracing along the full incision path.", "warning");
        return completeCurrentStep(
          { ...current, incisionComplete: true, incisionProgress: 1, completedActions: addAction(current.completedActions, action), selectedTool: "Needle holder" },
          "incision", "Incision completed cleanly. Switching to needle holder for wound closure."
        );
      }
    }

    // ── Stitch actions ──
    if ((stitchActions as readonly string[]).includes(action)) {
      if (current.currentStep !== 6) return addFeedback(current, "Closure not ready", `Finish "${procedureSteps[current.currentStep].title}" first.`, "warning", -2);
      const requiredTool = action === "Cut suture" ? "Surgical scissors" : "Needle holder";
      if (current.selectedTool !== requiredTool) return addFeedback(current, `${requiredTool} required`, `Select ${requiredTool.toLowerCase()} before continuing.`, "error", -2);
      const expected = stitchActions[current.stitchPhase];
      if (action !== expected) return addFeedback(current, "Follow the guided sequence", `Complete "${expected}" next.`, "warning", -1);
      if (action === "Position instrument" && (current.suturePosition < 43 || current.suturePosition > 57)) return addFeedback(current, "Entry point not aligned", "Move the holder into the highlighted entry zone.", "warning");
      if (action === "Match angle" && (current.sutureAngle < 45 || current.sutureAngle > 60)) return addFeedback(current, "Angle outside target", "Adjust the approach to 45°–60°.", "warning");
      const stitchPhase = current.stitchPhase + 1;
      const next = { ...current, stitchPhase, stitchProgress: 0, completedActions: addAction(current.completedActions, action) };

      if (stitchPhase === stitchActions.length) return completeCurrentStep({ ...next, selectedTool: null }, "suture", "The interrupted stitch is approximated, secured, and trimmed.");
      return addFeedback(next, action, action === "Begin stitch" ? "Needle followed the guided arc to the exit marker." : "Movement accepted. Continue to the next closure action.", "success");
    }

    if (action === "Finish procedure") {
      if (current.currentStep !== 7 || !current.completedSteps.includes("suture")) return addFeedback(current, "Procedure not ready to finish", "Complete the guided closure before final reassessment.", "error", -3);
      const completed = completeCurrentStep({ ...current, completedActions: addAction(addAction(current.completedActions, "safety"), action) }, "complete", "Final site and safety reassessment completed.");
      const finished = { ...completed, runStatus: "complete" as const, paused: false };
      try { localStorage.setItem("surgify:simulation-result", JSON.stringify({ score: finished.score, elapsedTime: finished.elapsedTime, completedSteps: finished.completedSteps, completedActions: finished.completedActions, events: finished.events, suturePosition: finished.suturePosition, sutureAngle: finished.sutureAngle, completedAt: new Date().toISOString() })); } catch { /* local persistence is optional */ }
      return finished;
    }

    if (["Inspect", "Inspect wound", "Palpate"].includes(action)) return addFeedback(current, action, current.currentStep === 1 ? "Select the reported injury directly on the patient." : "Observation recorded. Continue with the current objective.", "info");
    return addFeedback(current, `${action} unavailable`, `Finish "${procedureSteps[current.currentStep].title}" first.`, "warning", -1);
  }), []);

  const value = useMemo<SimulationContextValue>(() => ({
    state,
    startSimulation,
    selectRegion,
    selectTool,
    releaseTool,
    performAction,
    setCameraMode: mode => setState(current => ({ ...current, cameraMode: mode })),
    setPaused: paused => setState(current => current.runStatus === "active" ? { ...current, paused } : current),
    setSuturePosition: position => setState(current => ({ ...current, suturePosition: position })),
    setSutureAngle: angle => setState(current => ({ ...current, sutureAngle: angle })),
    setIncisionProgress: progress => setState(current => ({ ...current, incisionProgress: Math.min(1, Math.max(0, progress)) })),
    setStitchProgress: progress => setState(current => ({ ...current, stitchProgress: Math.min(1, Math.max(0, progress)) })),
    resetSimulation: () => setState(createInitialState()),
    toggleAnatomy: () => setState(current => ({ ...current, anatomyOverlay: !current.anatomyOverlay, cameraMode: !current.anatomyOverlay ? "anatomy" : "patient" })),
    toggleTracking: () => setState(current => ({ ...current, trackingOverlay: !current.trackingOverlay })),
    setUiCollapsed: (collapsed) => setState(current => ({ ...current, uiCollapsed: collapsed })),
  }), [state, startSimulation, selectRegion, selectTool, releaseTool, performAction]);

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) throw new Error("useSimulation must be used inside SimulationProvider");
  return context;
}
