"use client";

import { Activity, AlertTriangle, ArrowLeft, Check, CheckCircle2, Clock3, Crosshair, MousePointer2, RotateCcw, ShieldCheck, Sparkles, Target, TrendingUp, UserCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSimulation } from "@/components/simulation/SimulationProvider";
import { procedureSteps } from "@/data/simulationData";
import type { SimulationEvent } from "@/types/simulation";
import { formatTime } from "@/lib/utils";
import "./results.css";

type SavedResult = { score:number;elapsedTime:number;completedSteps:string[];completedActions:string[];events:SimulationEvent[];suturePosition:number;sutureAngle:number };

export default function ResultsPage() {
  const { state, resetSimulation } = useSimulation();
  const router = useRouter();
  // Read localStorage in an effect, not in the initializer: reading it during the
  // first render makes the client disagree with the (window-less) server HTML and
  // trips a hydration mismatch. Start null to match SSR, then hydrate post-mount.
  const [saved, setSaved] = useState<SavedResult|null>(null);
  useEffect(() => { try { setSaved(JSON.parse(localStorage.getItem("surgify:simulation-result") ?? "null")); } catch { /* ignore corrupt cache */ } }, []);
  const result: SavedResult|null = state.runStatus === "complete" ? state : saved;
  if (!result) return <div className="app-page results-app-page"><header className="app-page-header"><div><h1>Performance review</h1><p>Complete a scenario to generate a debrief.</p></div></header><div className="app-page-content result-content"><section className="no-result-state"><span><Target size={24}/></span><h2>No completed simulation yet</h2><p>Your sequence, accuracy, safety checks, and coach timeline will appear here after a completed run.</p><Link href="/scenarios" className="button button-primary button-md"><ArrowLeft size={14}/>Choose a scenario</Link></section></div></div>;

  const completedSteps = Array.isArray(result.completedSteps) ? result.completedSteps : [];
  const completedActions = Array.isArray(result.completedActions) ? result.completedActions : [];
  const events = Array.isArray(result.events) ? result.events : [];
  const score = Number.isFinite(result.score) ? result.score : 0;
  const positionAccuracy = Math.max(0, Math.round(100 - Math.abs((result.suturePosition ?? 50) - 50) * 2));
  const angleAccuracy = Math.max(0, Math.round(100 - Math.abs((result.sutureAngle ?? 52) - 52) * 2));
  const safety = completedActions.includes("safety") ? 100 : 60;
  const metrics = [
    ["Patient assessment", completedSteps.filter(id => ["review","identify","assess"].includes(id)).length / 3 * 100, UserCheck],
    ["Procedure sequence", completedSteps.length / procedureSteps.length * 100, TrendingUp],
    ["Instrument selection", ["Needle holder","Forceps"].every(item => completedActions.includes(item)) ? 100 : 50, MousePointer2],
    ["Entry-point accuracy", positionAccuracy, Crosshair],
    ["Tool-angle accuracy", angleAccuracy, Target],
    ["Movement control", score, Activity],
    ["Safety checks", safety, ShieldCheck],
  ] as const;
  const mistakes = events.filter(event => event.tone === "warning" || event.tone === "error");
  const correct = events.filter(event => event.tone === "success").slice(-6);
  const retry = () => { resetSimulation(); router.push("/simulation?scenario=forearm"); };

  return <div className="app-page results-app-page"><header className="app-page-header"><div><h1>Performance debrief</h1><p>Forearm Laceration — Basic Wound Closure</p></div><div className="app-page-header-actions"><span className="result-complete-chip"><CheckCircle2 size={13}/>Scenario completed</span><span className="result-time-chip"><Clock3 size={13}/>{formatTime(result.elapsedTime)}</span></div></header><div className="app-page-content result-content"><section className="scenario-result-summary"><div className="result-score-dial" style={{"--score":`${score*3.6}deg`} as React.CSSProperties}><div><strong>{score}</strong><span>/100</span></div></div><div className="result-summary-copy"><span><Sparkles size={13}/>Simulation complete</span><h2>Forearm Laceration — Basic Wound Closure</h2><p>You completed the full guided workflow. This debrief reflects the actions and corrections recorded during this attempt.</p><div><b>{mistakes.length ? "Completed with recoverable coaching" : "Excellent sequence control"}</b><i/>{mistakes.length} coached correction{mistakes.length === 1 ? "" : "s"}</div></div><div className="result-stat-stack"><div><span>Safety status</span><strong className={safety === 100 ? "text-success" : "text-warning"}>{safety === 100 ? "All checks passed" : "Review required"}</strong></div><div><span>Procedure time</span><strong className="mono">{formatTime(result.elapsedTime)}</strong></div><div><span>Recorded events</span><strong>{events.length}</strong></div></div></section><section className="result-metric-section"><div className="result-section-heading"><div><span>Measured performance</span><h2>Scenario metrics</h2></div><small>Frontend educational scoring</small></div><div className="scenario-metrics">{metrics.map(([label, rawValue, Icon]) => { const value = Math.round(rawValue); return <div className="scenario-metric" key={label}><span><Icon size={14}/>{label}</span><strong>{value}<small>%</small></strong><i><b style={{width:`${value}%`}}/></i><em>{value >= 90 ? "Strong" : value >= 75 ? "Developing" : "Review"}</em></div>; })}<div className="scenario-metric completion-metric"><span><Clock3 size={14}/>Completion time</span><strong className="mono">{formatTime(result.elapsedTime)}</strong><p>Suggested range: 08:00–12:00</p></div></div></section><section className="result-detail-grid"><div className="action-review"><div className="result-section-heading"><div><span>Workflow review</span><h2>Recorded performance</h2></div></div><div className="action-columns"><div><h3><CheckCircle2 size={13}/>Performed correctly</h3>{correct.length ? correct.map(item => <p key={item.id}><span><Check size={10}/></span>{item.label}</p>) : <p>No successful actions were recorded.</p>}</div><div className="missed-actions"><h3><AlertTriangle size={13}/>Coach corrections</h3>{mistakes.length ? mistakes.slice(-6).map((item,index) => <p key={item.id}><span>{index+1}</span>{item.label}</p>) : <p><span><Check size={10}/></span>No sequence or safety corrections recorded.</p>}</div></div></div><div className="result-timeline"><div className="result-section-heading"><div><span>Event log</span><h2>Attempt timeline</h2></div></div>{events.slice(-7).map(event => <div className={`result-event ${event.tone}`} key={event.id}><span className="mono">{formatTime(event.timestamp)}</span><i/><p>{event.label}</p></div>)}</div><div className="coach-summary"><div className="coach-summary-head"><span><Sparkles size={16}/></span><div><small>COACH SUMMARY</small><h2>{mistakes.length ? "Safe recovery with clear next steps" : "Controlled, sequence-aware performance"}</h2></div></div><p>{mistakes.length ? `You completed the scenario after ${mistakes.length} coached correction${mistakes.length === 1 ? "" : "s"}. Review the earliest warnings before your next attempt.` : "You completed the required assessment, preparation, instrument, and closure sequence without a recorded correction."}</p><div><strong>Next focus</strong><span>{angleAccuracy < 90 ? "Practice holding the needle holder within the 45°–60° approach window." : positionAccuracy < 90 ? "Refine entry-point alignment before beginning the needle arc." : "Repeat with reduced guidance and maintain the same sequence control."}</span></div></div></section><footer className="result-footer-actions"><button onClick={() => router.push("/scenarios")}><ArrowLeft size={13}/>Scenario library</button><div><button onClick={() => router.push("/anatomy")}>Review anatomy</button><button onClick={() => router.push("/instruments")}>Practice instruments</button><button onClick={retry}><RotateCcw size={13}/>Retry scenario</button></div></footer></div></div>;
}
