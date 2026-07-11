"use client";

import Link from "next/link";
import { DoorOpen, Pause, Play, RotateCcw, Settings, Video } from "lucide-react";
import { Brand } from "@/components/ui/Brand";
import { Badge } from "@/components/ui/Badge";
import { useSimulation } from "./SimulationProvider";
import { procedureSteps } from "@/data/simulationData";
import { formatTime } from "@/lib/utils";

export function SimulationTopbar() {
  const { state, setPaused, resetSimulation, setCameraMode } = useSimulation();
  const progress = Math.round((state.completedSteps.length / procedureSteps.length) * 100);
  return <header className="simulation-topbar"><div className="topbar-scenario"><Brand compact href="/simulation?scenario=forearm" /><span className="topbar-divider"/><div><strong>Forearm Laceration — Basic Wound Closure</strong><span>Alex Morgan · Case SG-2048</span></div><Badge tone="amber">Intermediate</Badge></div><div className="topbar-progress"><div className="sim-timer"><span>Simulation time</span><strong className="mono">{state.runStatus === "ready" ? "--:--" : formatTime(state.elapsedTime)}</strong></div><div className="stage-progress"><div><span>{state.runStatus === "ready" ? "Case briefing" : `Stage ${state.currentStep + 1} of ${procedureSteps.length}`}</span><strong>{state.runStatus === "ready" ? "Review objective and input" : procedureSteps[state.currentStep]?.title}</strong></div><i><b style={{width:`${progress}%`}}/></i></div></div><div className="topbar-actions"><button disabled={state.runStatus !== "active"} onClick={()=>setPaused(!state.paused)} title={state.paused?"Resume simulation":"Pause simulation"}>{state.paused?<Play size={14}/>:<Pause size={14}/>}<span>{state.paused?"Resume":"Pause"}</span></button><button onClick={resetSimulation} title="Restart scenario"><RotateCcw size={14}/><span>Restart</span></button><button onClick={()=>setCameraMode("room")} title="Reset camera"><Video size={14}/><span>Camera</span></button><Link href="/settings" title="Settings"><Settings size={14}/></Link><Link href="/scenarios" className="exit-action" title="Exit scenario" onClick={event=>{if(state.runStatus === "active"&&!window.confirm("Exit this attempt? Current unsaved progress will be lost.")){event.preventDefault();return}resetSimulation()}}><DoorOpen size={14}/><span>Exit</span></Link></div></header>;
}
