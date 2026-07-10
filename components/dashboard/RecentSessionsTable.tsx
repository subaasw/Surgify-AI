import { ArrowUp, CheckCircle2, MoreHorizontal } from "lucide-react";
import { recentSessions, scenarios } from "@/data/mockData";
import { Badge } from "@/components/ui/Badge";

export function RecentSessionsTable() {
  return (
    <div className="recent-table-wrap">
      <table className="recent-table">
        <thead><tr><th>Scenario</th><th>Date</th><th>Duration</th><th>Score</th><th>Status</th><th>Improvement</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {recentSessions.map((session, index) => {
            const scenario = scenarios.find(s => s.id === session.scenarioId)!;
            return <tr key={session.id}>
              <td><span className={`scenario-dot scenario-dot-${index + 1}`} /><div><strong>{scenario.name}</strong><span>{scenario.skills[0]}</span></div></td>
              <td>{session.date}</td><td className="mono">{Math.floor(session.duration / 60)}m {session.duration % 60}s</td>
              <td><strong className="table-score">{session.score}</strong><span className="score-out">/100</span></td>
              <td><Badge tone="green"><CheckCircle2 size={10} /> Completed</Badge></td>
              <td><span className="improvement"><ArrowUp size={11} />+{[6,3,8,4][index]}%</span></td>
              <td><button className="table-action" aria-label={`Open ${scenario.name} session`}><MoreHorizontal size={16} /></button></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}
