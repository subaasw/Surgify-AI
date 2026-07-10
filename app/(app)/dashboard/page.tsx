import { Activity, ArrowRight, Award, Clock3, Play, Sparkles, Target, TrendingUp, WandSparkles } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { SkillChart } from "@/components/dashboard/SkillChart";
import { RecentSessionsTable } from "@/components/dashboard/RecentSessionsTable";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import "./dashboard.css";

const recommendations = [
  { title: "Reduce unnecessary wrist movement", text: "Your last attempt showed 18% more lateral movement than your personal best.", icon: Activity, tone: "cyan" },
  { title: "Improve needle exit symmetry", text: "Aim for an exit point within 2 mm of the reflected entry position.", icon: Target, tone: "amber" },
  { title: "Maintain a consistent tool angle", text: "Practise holding between 45° and 60° during the full approach.", icon: TrendingUp, tone: "blue" },
];

export default function DashboardPage() {
  return (
    <div className="page-wrap dashboard-page">
      <DashboardHeader />
      <section className="metric-grid" aria-label="Training summary">
        <MetricCard label="Overall skill score" value={82} change="4.8%" icon={Award} index={0} />
        <MetricCard label="Sessions completed" value={24} change="3 this week" icon={Activity} index={1} />
        <MetricCard label="Total practice time" value="7.8" unit="hours" change="1.2h" icon={Clock3} index={2} />
        <MetricCard label="Improvement this month" value="+14" unit="%" change="On track" icon={TrendingUp} index={3} />
      </section>

      <section className="dashboard-main-grid">
        <Card className="continue-panel">
          <div className="continue-visual">
            <div className="continue-pad"><span /><i /><b /></div>
            <div className="continue-overlay"><span>Next focus</span><strong>Entry → exit alignment</strong></div>
          </div>
          <div className="continue-copy">
            <div><Badge tone="blue">Continue training</Badge><span className="level-label">Level 3 · Intermediate</span></div>
            <h2>Simple Interrupted Suture</h2>
            <p>Continue your guided stitch sequence and improve exit symmetry.</p>
            <div className="continue-scores"><div><span>Last score</span><strong>78</strong></div><div><span>Personal best</span><strong>86</strong></div><div><span>Progress</span><strong className="text-success">71%</strong></div></div>
            <ButtonLink href="/training/suture">Continue Training <Play size={15} fill="currentColor" /></ButtonLink>
          </div>
        </Card>
        <Card className="skill-panel panel-pad">
          <div className="card-title-row"><div><p className="eyebrow">Skill map</p><h3>Performance breakdown</h3></div><Badge tone="green">Strong</Badge></div>
          <SkillChart />
          <div className="skill-panel-footer"><span><i className="cyan-dot" /> Current profile</span><strong>84.2 avg.</strong></div>
        </Card>
      </section>

      <section className="recommendation-section">
        <div className="dashboard-section-title"><div><p className="eyebrow"><WandSparkles size={12} /> AI recommendations</p><h2>Recommended practice</h2></div><span>Based on your last 5 sessions</span></div>
        <div className="recommendation-grid">
          {recommendations.map(({ title, text, icon: Icon, tone }, index) => (
            <Card className="recommendation-card" key={title}>
              <div className={`recommendation-icon ${tone}`}><Icon size={18} /></div><div><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p><a href="/training">Start focused drill <ArrowRight size={13} /></a></div>
            </Card>
          ))}
        </div>
      </section>

      <section className="recent-section">
        <div className="dashboard-section-title"><div><p className="eyebrow"><Sparkles size={12} /> Learning history</p><h2>Recent sessions</h2></div><ButtonLink href="/results" variant="ghost" size="sm">View all results <ArrowRight size={14} /></ButtonLink></div>
        <Card className="recent-card"><RecentSessionsTable /></Card>
      </section>
    </div>
  );
}
