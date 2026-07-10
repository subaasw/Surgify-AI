import { Check, Circle, Clock3, Gauge, Wrench } from "lucide-react";
import { formatTime } from "@/lib/utils";

export const procedureSteps = [
  "Position the practice pad",
  "Pick up the needle holder",
  "Align the needle",
  "Enter the marked entry zone",
  "Exit through the target zone",
  "Pull the suture through",
  "Complete the knot",
];

export function ProcedureSteps({ activeStep, seconds, running }: { activeStep: number; seconds: number; running: boolean }) {
  return (
    <aside className="session-left panel">
      <div className="session-scenario-head"><div><span className="eyebrow">Active scenario</span><h2>Simple Interrupted Suture</h2></div><span className="level-chip">L3</span></div>
      <div className="session-timer"><div><Clock3 size={16} /><span>Session time</span></div><strong className="mono">{formatTime(seconds)}</strong><i className={running ? "running" : ""} /></div>
      <div className="procedure-head"><span>Procedure checklist</span><b>{Math.min(activeStep, 7)}/7 complete</b></div>
      <ol className="procedure-list">
        {procedureSteps.map((step, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          return <li key={step} className={active ? "active" : done ? "done" : ""}><span className="step-dot">{done ? <Check size={12} /> : active ? <Gauge size={12} /> : <Circle size={8} />}</span><div><small>Step {i + 1}</small><strong>{step}</strong></div></li>;
        })}
      </ol>
      <div className="tool-status panel-inset"><div className="tool-status-icon"><Wrench size={16} /></div><div><span>Primary tool</span><strong>Needle Holder</strong><small><i /> Detected · Ready</small></div><b>96%</b></div>
    </aside>
  );
}
