"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CameraMode, CoachMessage, SimulationState } from "@/types/simulation";
import { procedureSteps } from "@/data/simulationData";

const initialState: SimulationState = {
  selectedRegion: null,
  selectedTool: null,
  currentStep: 0,
  completedSteps: [],
  completedActions: [],
  cameraMode: "room",
  paused: false,
  elapsedTime: 0,
  score: 82,
  vitals: { heartRate: 88, systolic: 122, diastolic: 78, oxygenSaturation: 98, respiratoryRate: 16, temperature: 36.8 },
  feedback: [{ id: "start", tone: "info", title: "Scenario ready", message: "Begin by reviewing the fictional patient information and confirming identity.", timestamp: 0 }],
  anatomyOverlay: false,
  trackingOverlay: false,
  stitchPhase: 0,
};

type SimulationContextValue = {
  state: SimulationState;
  completeStep: (id: string, message?: string) => void;
  selectRegion: (region: string) => void;
  selectTool: (tool: string) => void;
  performAction: (action: string) => void;
  setCameraMode: (mode: CameraMode) => void;
  setPaused: (paused: boolean) => void;
  resetSimulation: () => void;
  toggleAnatomy: () => void;
  toggleTracking: () => void;
};

const SimulationContext = createContext<SimulationContextValue | null>(null);

function nextStep(completed: string[]) {
  const index = procedureSteps.findIndex(step => !completed.includes(step.id));
  return index < 0 ? procedureSteps.length - 1 : index;
}

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SimulationState>(initialState);

  useEffect(() => {
    if (state.paused) return;
    const timer = window.setInterval(() => setState((current): SimulationState => {
      const pulse = Math.round(Math.sin(current.elapsedTime / 8));
      return { ...current, elapsedTime: current.elapsedTime + 1, vitals: { ...current.vitals, heartRate: 88 + pulse, oxygenSaturation: current.elapsedTime % 17 === 0 ? 97 : 98, respiratoryRate: 16 + (current.elapsedTime % 20 === 0 ? 1 : 0) } };
    }), 1000);
    return () => clearInterval(timer);
  }, [state.paused]);

  const addFeedback = useCallback((title: string, message: string, tone: CoachMessage["tone"] = "info") => {
    setState((current): SimulationState => ({ ...current, feedback: [{ id: `${Date.now()}-${title}`, title, message, tone, timestamp: current.elapsedTime }, ...current.feedback].slice(0, 8) }));
  }, []);

  const completeStep = useCallback((id: string, message?: string) => {
    setState((current): SimulationState => {
      if (current.completedSteps.includes(id)) return current;
      const completedSteps = [...current.completedSteps, id];
      return { ...current, completedSteps, currentStep: nextStep(completedSteps), score: Math.min(100, current.score + 2), feedback: message ? [{ id: `${Date.now()}-${id}`, tone: "success" as const, title: "Step completed", message, timestamp: current.elapsedTime }, ...current.feedback].slice(0, 8) : current.feedback };
    });
  }, []);

  const selectRegion = useCallback((region: string) => {
    setState((current): SimulationState => ({ ...current, selectedRegion: region, cameraMode: region === "Right arm" ? "closeup" : "patient", feedback: [{ id: `${Date.now()}-region`, tone: (region === "Right arm" ? "success" : "warning") as CoachMessage["tone"], title: region === "Right arm" ? "Correct region selected" : `${region} selected`, message: region === "Right arm" ? "Right forearm selected. Inspect the synthetic wound patch, then check distal circulation." : "The case summary identifies the right forearm. Reassess the reported pain location.", timestamp: current.elapsedTime }, ...current.feedback].slice(0, 8), score: region === "Right arm" ? current.score + 2 : Math.max(0, current.score - 2) }));
    if (region === "Right arm") completeStep("identify");
  }, [completeStep]);

  const selectTool = useCallback((tool: string) => {
    setState((current): SimulationState => ({ ...current, selectedTool: tool, feedback: [{ id: `${Date.now()}-tool`, tone: (tool === "Needle holder" || !current.completedSteps.includes("instruments") ? "info" : "warning") as CoachMessage["tone"], title: `${tool} active`, message: tool === "Needle holder" ? "Grip at the ring handles and keep the active tip in view." : `${tool} is ready in the active tool slot.`, timestamp: current.elapsedTime }, ...current.feedback].slice(0, 8) }));
    if (tool === "Needle holder") completeStep("instruments", "Correct primary instrument selected. Position it above the entry marker.");
  }, [completeStep]);

  const performAction = useCallback((action: string) => {
    setState((current): SimulationState => {
      if (current.completedActions.includes(action)) return current;
      return { ...current, completedActions: [...current.completedActions, action] };
    });

    if (action === "Review patient information") { completeStep("review", "Patient identity, case summary, and fictional history reviewed."); return; }
    if (action === "Check allergies") { setState(c => ({ ...c, completedActions: [...new Set([...c.completedActions, "allergy"])] })); addFeedback("Allergy status checked", "Alex reports no known medication or latex allergies.", "success"); return; }
    if (["Check pulse", "Check sensation", "Check movement"].includes(action)) {
      setState((current): SimulationState => {
        const actions = [...new Set([...current.completedActions, action])];
        const ready = actions.includes("Check pulse") && actions.includes("Check sensation");
        return { ...current, completedActions: actions, completedSteps: ready && !current.completedSteps.includes("assess") ? [...current.completedSteps, "assess"] : current.completedSteps, currentStep: ready ? nextStep([...current.completedSteps, "assess"]) : current.currentStep, feedback: [{ id: `${Date.now()}-exam`, tone: "success" as const, title: action, message: action === "Check pulse" ? "Radial pulse palpable. Capillary refill is within the simulated normal range." : action === "Check sensation" ? "Sensation is intact distal to the training patch." : "Finger movement is present and symmetrical.", timestamp: current.elapsedTime }, ...current.feedback].slice(0, 8) };
      });
      return;
    }
    if (["Gloves", "Antiseptic", "Sterile drape", "Clean wound"].includes(action)) {
      setState((current): SimulationState => {
        const actions = [...new Set([...current.completedActions, action])];
        const ready = actions.includes("Antiseptic") && actions.includes("Sterile drape");
        const completed = ready && !current.completedSteps.includes("prepare") ? [...current.completedSteps, "prepare"] : current.completedSteps;
        return { ...current, completedActions: actions, completedSteps: completed, currentStep: ready ? nextStep(completed) : current.currentStep, feedback: [{ id: `${Date.now()}-prep`, tone: "success" as const, title: action, message: ready ? "Synthetic wound surface prepared and sterile field established." : `${action} applied to the simulated field.`, timestamp: current.elapsedTime }, ...current.feedback].slice(0, 8) };
      });
      return;
    }

    const phaseMap: Record<string, number> = { "Position instrument": 1, "Match angle": 2, "Begin stitch": 3, "Pull suture": 4, "Tie knot": 5, "Cut suture": 6 };
    if (action in phaseMap) {
      setState((current): SimulationState => {
        if (current.selectedTool !== "Needle holder" && phaseMap[action] <= 3) return { ...current, score: Math.max(0, current.score - 3), feedback: [{ id: `${Date.now()}-wrong`, tone: "error" as const, title: "Needle holder required", message: "Select the needle holder before positioning the curved needle.", timestamp: current.elapsedTime }, ...current.feedback].slice(0, 8) };
        const phase = Math.max(current.stitchPhase, phaseMap[action]);
        const sutureComplete = phase >= 6;
        const completed = sutureComplete && !current.completedSteps.includes("suture") ? [...current.completedSteps, "suture"] : current.completedSteps;
        return { ...current, stitchPhase: phase, completedSteps: completed, currentStep: sutureComplete ? nextStep(completed) : current.currentStep, score: Math.min(100, current.score + 1), feedback: [{ id: `${Date.now()}-suture`, tone: "success" as const, title: action, message: action === "Match angle" ? "Tool angle is within the recommended 45°–60° range." : action === "Begin stitch" ? "Needle following the predefined training arc toward the exit marker." : action === "Cut suture" ? "Guided stitch complete. Perform the final safety reassessment." : `${action} completed smoothly.`, timestamp: current.elapsedTime }, ...current.feedback].slice(0, 8) };
      });
      return;
    }
    if (action === "Finish procedure") {
      completeStep("complete", "Scenario complete. Review your performance summary.");
      setState((current): SimulationState => {
        try { localStorage.setItem("surgify:simulation-result", JSON.stringify({ score: current.score, elapsedTime: current.elapsedTime, completedAt: new Date().toISOString() })); } catch { /* local persistence is optional */ }
        return { ...current, completedActions: [...new Set([...current.completedActions, "safety", "Finish procedure"])] };
      });
    }
  }, [addFeedback, completeStep]);

  const value = useMemo<SimulationContextValue>(() => ({
    state,
    completeStep,
    selectRegion,
    selectTool,
    performAction,
    setCameraMode: mode => setState(current => ({ ...current, cameraMode: mode })),
    setPaused: paused => setState(current => ({ ...current, paused })),
    resetSimulation: () => setState(initialState),
    toggleAnatomy: () => setState(current => ({ ...current, anatomyOverlay: !current.anatomyOverlay, cameraMode: !current.anatomyOverlay ? "anatomy" : "patient" })),
    toggleTracking: () => setState(current => ({ ...current, trackingOverlay: !current.trackingOverlay })),
  }), [state, completeStep, selectRegion, selectTool, performAction]);

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) throw new Error("useSimulation must be used inside SimulationProvider");
  return context;
}
