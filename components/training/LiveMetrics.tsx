import { Activity, BrainCircuit, ShieldAlert } from "lucide-react";
import { ProgressRing } from "@/components/ui/ProgressRing";

export type LiveMetricValues = { accuracy: number; efficiency: number; stability: number; safety: number; score: number };

export function LiveMetrics({ metrics, coachIndex, warning }: { metrics: LiveMetricValues; coachIndex: number; warning: string | null }) {
  const coaching = [
    ["Your tool angle is stable.", "Maintain this approach as you reach the marked entry zone."],
    ["Move 4 mm closer to the entry point.", "Use the cyan marker as your alignment reference."],
    ["Reduce wrist rotation during approach.", "Let the instrument joint guide the arc."],
    ["Good entry angle. Continue smoothly.", "Keep a consistent speed toward the exit marker."],
  ];
  return (
    <aside className="session-right">
      <div className="score-panel panel">
        <div className="live-score-head"><div><span>Current score</span><strong>{Math.round(metrics.score)}</strong><small>/100</small></div><span className="live-badge"><i /> Live</span></div>
        <div className="live-ring-grid"><ProgressRing value={metrics.accuracy} label="Accuracy" size="sm" /><ProgressRing value={metrics.efficiency} label="Efficiency" size="sm" /><ProgressRing value={metrics.stability} label="Stability" size="sm" /><ProgressRing value={metrics.safety} label="Safety" size="sm" tone="green" /></div>
      </div>
      <div className="coach-panel panel">
        <div className="coach-head"><span className="coach-icon"><BrainCircuit size={17} /></span><div><strong>AI Coach</strong><small>Simulated live guidance</small></div><i /></div>
        <div className="coach-message"><span>NOW</span><strong>{coaching[coachIndex][0]}</strong><p>{coaching[coachIndex][1]}</p></div>
        <div className="coach-wave">{[2,5,8,4,11,7,4,8,12,6,3,8,5,9,4,2,6,8,3].map((h,i) => <i key={i} style={{height:h}} />)}</div>
      </div>
      <div className={warning ? "warning-panel panel active" : "warning-panel panel"}>
        <div className="warning-head"><ShieldAlert size={17} /><div><strong>Safety monitor</strong><span>{warning ? "Attention required" : "All zones clear"}</span></div><i /></div>
        {warning ? <div className="warning-copy"><strong>{warning}</strong><span>Correct your approach before continuing.</span></div> : <p>No warnings detected. Maintain controlled movement.</p>}
      </div>
      <div className="motion-panel panel"><div><span>Motion signature</span><strong>Controlled</strong></div><div className="motion-wave">{[21,34,28,43,38,54,49,62,45,53,39,32].map((h,i)=><i key={i} style={{height:`${h}%`}} />)}</div><div className="motion-label"><span>0.42 m path</span><span>12.8° rotation</span></div></div>
    </aside>
  );
}
