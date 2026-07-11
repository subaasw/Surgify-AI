"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { CameraMode, CoachMessage, SimulationState } from "@/types/simulation";
import { procedureSteps, stitchActions } from "@/data/simulationData";
import { INCISION_SEGMENTS } from "@/lib/handPhysics.mjs";

const createInitialState = (): SimulationState => ({
  runStatus: "ready",
  patientName: "Alex Morgan",
  selectedRegion: null,
  selectedTool: null,
  heldTools: { Left: null, Right: null },
  surfaceContact: false,
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
  incisionSegments: [],
  incisionDepth: 0,
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
  grabTool: (side: "Left" | "Right", tool: string) => void;
  releaseHeldTool: (side: "Left" | "Right") => void;
  recordCutSegment: (segment: number, depth: number) => void;
  setSurfaceContact: (contact: boolean) => void;
  performAction: (action: string) => void;
  setCameraMode: (mode: CameraMode) => void;
  setPaused: (paused: boolean) => void;
  setSuturePosition: (position: number) => void;
  setSutureAngle: (angle: number) => void;
  setStitchProgress: (progress: number) => void;
  resetSimulation: () => void;
  toggleAnatomy: () => void;
  toggleTracking: () => void;
  setUiCollapsed: (collapsed: boolean) => void;
  setPatientName: (name: string) => void;
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

function demoAdvanceStep(current: SimulationState): SimulationState {
  const step = procedureSteps[current.currentStep];
  let next = { ...current, selectedTool: null, heldTools: { Left: null, Right: null }, surfaceContact: false };
  const actions: Record<number, string[]> = {
    0: ["allergy", "Review patient information"],
    2: ["Check pulse", "Check sensation", "Check movement"],
    3: ["Gloves", "Antiseptic", "Sterile drape"],
    4: ["Needle holder", "Forceps"],
  };
  next.completedActions = [...new Set([...next.completedActions, ...(actions[current.currentStep] ?? [])])];
  if (current.currentStep === 1) next.selectedRegion = "Right arm";
  if (current.currentStep === 5) next = { ...next, incisionSegments: Array.from({ length: INCISION_SEGMENTS }, (_, index) => index), incisionDepth: .025, incisionProgress: 1, incisionComplete: true, completedActions: addAction(next.completedActions, "Complete incision") };
  if (current.currentStep === 6) next = { ...next, stitchPhase: stitchActions.length, stitchProgress: 1, suturePosition: 50, sutureAngle: 52, completedActions: [...new Set([...next.completedActions, ...stitchActions])] };
  if (current.currentStep === 7) next.completedActions = addAction(addAction(next.completedActions, "safety"), "Finish procedure");
  const advanced = completeCurrentStep(next, step.id, "Demo assist: stage advanced after the 10-second limit.");
  return current.currentStep === 7 ? { ...advanced, runStatus: "complete", paused: false } : advanced;
}

function selectToolState(current: SimulationState, tool: string): SimulationState {
  if (current.runStatus !== "active") return current;
  const selected = { ...current, selectedTool: tool };
  if (tool === "Scalpel") {
    if (current.currentStep !== 5) return addFeedback(selected, "Scalpel not needed yet", `Finish "${procedureSteps[current.currentStep].title}" first.`, "warning", -1);
    return addFeedback(selected, "Scalpel held", "Bring the blade tip to the first incision marker.", "info");
  }
  if (current.currentStep > 4) return addFeedback(selected, `${tool} held`, "The physical instrument is now controlled by your projected hand.", "info");
  if (current.currentStep !== 4) return addFeedback(selected, "Instrument selected early", `Finish "${procedureSteps[current.currentStep].title}" before instrument setup.`, "warning", -1);
  if (!["Needle holder", "Forceps"].includes(tool)) return addFeedback(selected, "Instrument not required", "Confirm the needle holder and forceps for this exercise.", "warning", -2);
  const completedActions = addAction(current.completedActions, tool);
  const next = { ...selected, completedActions };
  return completedActions.includes("Needle holder") && completedActions.includes("Forceps")
    ? completeCurrentStep(next, "instruments", "Both microsurgical instruments were physically picked up. Expose the nerve with the scalpel.")
    : addFeedback(next, `${tool} confirmed`, `Now pick up ${tool === "Needle holder" ? "the forceps" : "the needle holder"}.`, "success");
}

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SimulationState>(createInitialState);
  const pathname = usePathname();
  const processingId = useRef<string | null>(null);

  useEffect(() => {
    try {
      const preferences = JSON.parse(localStorage.getItem("surgify:simulation-preferences") ?? "{}");
      for (const [key, value] of Object.entries(preferences)) document.documentElement.dataset[key] = String(value);
    } catch { /* preferences are optional */ }
  }, []);

  useEffect(() => {
    const latest = state.feedback[0];
    if (!latest || latest.id === "ready" || latest.id === processingId.current) return;

    processingId.current = latest.id;
    const originalMessage = latest.message;

    fetch("http://localhost:8000/api/v1/coach/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: originalMessage, metrics: { score: state.score } })
    })
      .then(res => res.json())
      .then(data => {
        setState(current => ({
          ...current,
          feedback: current.feedback.map(f => f.id === latest.id ? { ...f, message: data.ai_message || originalMessage } : f)
        }));
        if (data.audio_data) {
          new Audio(data.audio_data).play().catch(console.error);
        }
      })
      .catch(err => {
        console.error("AI Coach Error:", err);
        setState(current => ({
          ...current,
          feedback: current.feedback.map(f => f.id === latest.id ? { ...f, message: originalMessage } : f)
        }));
      });
  }, [state.feedback, state.score]);

  useEffect(() => {
    if (pathname !== "/simulation" || state.runStatus !== "active" || state.paused) return;
    const timer = window.setInterval(() => setState(current => {
      const pulse = Math.round(Math.sin(current.elapsedTime / 8));
      return { ...current, elapsedTime: current.elapsedTime + 1, vitals: { ...current.vitals, heartRate: 88 + pulse, oxygenSaturation: current.elapsedTime % 17 === 0 ? 97 : 98, respiratoryRate: 16 + (current.elapsedTime % 20 === 0 ? 1 : 0) } };
    }), 1000);
    return () => clearInterval(timer);
  }, [pathname, state.runStatus, state.paused]);

  useEffect(() => {
    if (pathname !== "/simulation" || state.runStatus !== "active" || state.paused) return;
    const step = state.currentStep;
    const timer = window.setTimeout(() => setState(current => {
      if (current.currentStep !== step || current.runStatus !== "active") return current;
      return demoAdvanceStep(current);
    }), 10_000);
    return () => window.clearTimeout(timer);
  }, [pathname, state.currentStep, state.runStatus, state.paused]);

  useEffect(() => {
    if (state.runStatus !== "complete") return;
    try { localStorage.setItem("surgify:simulation-result", JSON.stringify({ score: state.score, elapsedTime: state.elapsedTime, completedSteps: state.completedSteps, completedActions: state.completedActions, events: state.events, suturePosition: state.suturePosition, sutureAngle: state.sutureAngle, completedAt: new Date().toISOString() })); } catch { /* local persistence is optional */ }
  }, [state.runStatus, state.score, state.elapsedTime, state.completedSteps, state.completedActions, state.events, state.suturePosition, state.sutureAngle]);

  const startSimulation = useCallback(() => setState(current => current.runStatus === "ready"
    ? addFeedback({ ...current, runStatus: "active" }, "Simulation started", "Confirm identity and allergy status before examining the injury.", "info")
    : current), []);

  const selectRegion = useCallback((region: string) => setState(current => {
    if (current.runStatus !== "active") return current;
    const selected = { ...current, selectedRegion: region, cameraMode: region === "Right arm" ? "closeup" as const : "patient" as const };
    if (region !== "Right arm") return addFeedback(selected, `${region} selected`, "The case history identifies the right forearm. Reassess the reported pain location.", "warning", -2);
    if (current.currentStep === 1) return completeCurrentStep(selected, "identify", "Right forearm selected and the virtual incision site identified.");
    if (current.currentStep < 1) return addFeedback(selected, "Correct site found early", "Finish the patient review before examining the injury.", "warning", -1);
    return addFeedback(selected, "Right forearm focused", "The procedure site is in view.", "info");
  }), []);

  const selectTool = useCallback((tool: string) => setState(current => selectToolState(current, tool)), []);

  const releaseTool = useCallback(() => setState(current => addFeedback({ ...current, selectedTool: null }, "Tool returned", "The active instrument was returned to the tray.", "info")), []);

  const grabTool = useCallback((side: "Left" | "Right", tool: string) => setState(current => {
    const selected = selectToolState(current, tool);
    return { ...selected, selectedTool: tool, heldTools: { ...selected.heldTools, [side]: tool } };
  }), []);

  const releaseHeldTool = useCallback((side: "Left" | "Right") => setState(current => {
    const tool = current.heldTools[side];
    if (!tool) return current;
    return { ...current, selectedTool: current.selectedTool === tool ? null : current.selectedTool, heldTools: { ...current.heldTools, [side]: null }, surfaceContact: false };
  }), []);

  const recordCutSegment = useCallback((segment: number, depth: number) => setState(current => {
    if (current.currentStep !== 5 || !Object.values(current.heldTools).includes("Scalpel")) return current;
    const incisionSegments = addAction(current.incisionSegments.map(String), String(segment)).map(Number).sort((a, b) => a - b);
    if (incisionSegments.length === current.incisionSegments.length && depth <= current.incisionDepth) return current;
    let next: SimulationState = {
      ...current,
      incisionSegments,
      incisionDepth: Math.max(current.incisionDepth, Math.min(.025, Math.max(0, depth))),
      incisionProgress: incisionSegments.length / INCISION_SEGMENTS,
      completedActions: current.completedActions.includes("Begin incision") ? current.completedActions : addAction(current.completedActions, "Begin incision"),
    };
    if (!current.completedActions.includes("Begin incision")) next = addFeedback(next, "Incision started", "Blade contact detected. Continue through the guide without leaving the skin surface.", "info");
    if (incisionSegments.length >= INCISION_SEGMENTS && incisionSegments.includes(INCISION_SEGMENTS - 1)) {
      next = completeCurrentStep({ ...next, incisionComplete: true, incisionProgress: 1, completedActions: addAction(next.completedActions, "Complete incision") }, "incision", "The traced incision exposed the divided nerve. Release the scalpel and pick up the forceps.");
    }
    return next;
  }), []);

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
      if (ready) return completeCurrentStep(next, "assess", "Distal pulse is intact; reduced thumb-index sensation supports a forearm nerve injury.");
      return addFeedback(next, action, `${assessmentActions.filter(item => !completedActions.includes(item)).length} assessment check${assessmentActions.filter(item => !completedActions.includes(item)).length === 1 ? "" : "s"} remaining.`, "success");
    }

    const preparationActions = ["Gloves", "Antiseptic", "Sterile drape"];
    if ([...preparationActions, "Gauze", "Clean wound", "Local anaesthetic simulation"].includes(action)) {
      if (current.currentStep !== 3) return addFeedback(current, "Preparation out of sequence", `Finish "${procedureSteps[current.currentStep].title}" first.`, "warning", -1);
      const completedActions = addAction(current.completedActions, action);
      const ready = preparationActions.every(item => completedActions.includes(item));
      const next = { ...current, completedActions };
      if (ready) return completeCurrentStep(next, "prepare", "Gloves applied, virtual forearm cleansed, and sterile field established.");
      return addFeedback(next, action, `${preparationActions.filter(item => !completedActions.includes(item)).length} required preparation item${preparationActions.filter(item => !completedActions.includes(item)).length === 1 ? "" : "s"} remaining.`, "success");
    }

    // ── Stitch actions ──
    if ((stitchActions as readonly string[]).includes(action)) {
      if (current.currentStep !== 6) return addFeedback(current, "Nerve repair not ready", `Finish "${procedureSteps[current.currentStep].title}" first.`, "warning", -2);
      const held = Object.values(current.heldTools);
      const required = action === "Align nerve ends" ? ["Forceps"]
        : action === "Tie repair knot" ? ["Needle holder", "Forceps"]
        : action === "Cut microsuture" ? ["Surgical scissors"]
        : ["Needle holder"];
      if (!required.every(tool => held.includes(tool))) return addFeedback(current, `${required.join(" and ")} required`, "Pick up the required instrument with a projected hand before continuing.", "error", -2);
      const expected = stitchActions[current.stitchPhase];
      if (action !== expected) return addFeedback(current, "Follow the guided sequence", `Complete "${expected}" next.`, "warning", -1);
      if (action === "Align nerve ends" && (current.suturePosition < 43 || current.suturePosition > 57)) return addFeedback(current, "Nerve ends not aligned", "Bring both highlighted nerve ends into the approximation zone.", "warning");
      if (action === "Set repair angle" && (current.sutureAngle < 45 || current.sutureAngle > 60)) return addFeedback(current, "Angle outside target", "Adjust the microsuture approach to 45°–60°.", "warning");
      const stitchPhase = current.stitchPhase + 1;
      const next = { ...current, stitchPhase, stitchProgress: 0, completedActions: addAction(current.completedActions, action) };

      if (stitchPhase === stitchActions.length) return completeCurrentStep(next, "suture", "The nerve ends are approximated and the repair microsuture is secured and trimmed.");
      return addFeedback(next, action, action === "Pass repair stitch" ? "The needle followed the guided epineurial arc." : "Movement accepted. Continue to the next nerve-repair action.", "success");
    }

    if (action === "Finish procedure") {
      if (current.currentStep !== 7 || !current.completedSteps.includes("suture")) return addFeedback(current, "Procedure not ready to finish", "Complete the guided nerve repair before final reassessment.", "error", -3);
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
    grabTool,
    releaseHeldTool,
    recordCutSegment,
    setSurfaceContact: contact => setState(current => current.surfaceContact === contact ? current : { ...current, surfaceContact: contact }),
    performAction,
    setCameraMode: mode => setState(current => ({ ...current, cameraMode: mode })),
    setPaused: paused => setState(current => current.runStatus === "active" ? { ...current, paused } : current),
    setSuturePosition: position => setState(current => current.suturePosition === position ? current : { ...current, suturePosition: position }),
    setSutureAngle: angle => setState(current => current.sutureAngle === angle ? current : { ...current, sutureAngle: angle }),
    setStitchProgress: progress => setState(current => {
      const next = Math.round(Math.min(1, Math.max(0, progress)) * 100) / 100;
      return current.stitchProgress === next ? current : { ...current, stitchProgress: next };
    }),
    resetSimulation: () => setState(current => ({
      ...createInitialState(),
      patientName: current.patientName,
      trackingOverlay: current.trackingOverlay,
      uiCollapsed: current.trackingOverlay,
    })),
    toggleAnatomy: () => setState(current => ({ ...current, anatomyOverlay: !current.anatomyOverlay, cameraMode: !current.anatomyOverlay ? "anatomy" : "patient" })),
    toggleTracking: () => setState(current => ({ ...current, trackingOverlay: !current.trackingOverlay })),
    setUiCollapsed: (collapsed) => setState(current => ({ ...current, uiCollapsed: collapsed })),
    setPatientName: name => setState(current => ({ ...current, patientName: name.trim() || "Alex Morgan" })),
  }), [state, startSimulation, selectRegion, selectTool, releaseTool, grabTool, releaseHeldTool, recordCutSegment, performAction]);

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) throw new Error("useSimulation must be used inside SimulationProvider");
  return context;
}
