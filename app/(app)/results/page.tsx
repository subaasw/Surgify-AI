"use client";

import { ArrowLeft, ArrowRight, Award, CheckCircle2, Clock3, Crosshair, Medal, RotateCcw, ShieldCheck, Sparkles, Target, TrendingUp, WandSparkles } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { ComparisonChart } from "@/components/results/ComparisonChart";
import { TrajectoryReplay } from "@/components/results/TrajectoryReplay";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressRing } from "@/components/ui/ProgressRing";
import "./results.css";

const metrics = [["Accuracy",84,Crosshair],["Motion efficiency",76,TrendingUp],["Stability",81,Target],["Procedure sequence",88,CheckCircle2],["Safety compliance",92,ShieldCheck]] as const;
const errors = [
  ["00:34","Excessive wrist rotation","Your approach rotated 14° beyond the efficient range.","amber"],
  ["01:12","Entry point missed by 6 mm","Needle entry occurred outside the 4 mm target zone.","red"],
  ["02:08","Safety zone entered","Tool tip crossed the lower no-touch boundary for 0.8 seconds.","red"],
  ["02:54","Stitch spacing improved","Spacing returned to within the target alignment range.","green"],
] as const;

export default function ResultsPage(){
  return <div className="page-wrap results-page"><DashboardHeader title="Session results" description="Simple Interrupted Suture · Attempt #24 · Today, 08:42" />
    <section className="result-hero panel">
      <div className="result-score-block"><div className="result-ring"><ProgressRing value={82} size="lg" tone="cyan"/><span>Session score</span></div><div><Badge tone="green"><Medal size={11}/> Good progress</Badge><h2>A more controlled attempt.</h2><p>Your entry alignment and safety awareness improved. Motion efficiency is the clearest opportunity for your next session.</p></div></div>
      <div className="result-improvement"><span>Improvement</span><strong>+6<small> points</small></strong><p>compared with your previous attempt</p><div>{[44,52,48,60,65,61,72,82].map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}</div></div>
      <div className="result-best"><Award size={20}/><span>Personal best</span><strong>86</strong><small>4 points away</small></div>
    </section>
    <section className="performance-section"><div className="results-section-title"><div><p className="eyebrow">Performance profile</p><h2>Skill breakdown</h2></div><div className="completion-time"><Clock3 size={15}/><span>Completion time</span><strong className="mono">03:42</strong></div></div><div className="result-metric-grid">{metrics.map(([label,value,Icon])=><Card className="result-metric" key={label}><div><Icon size={16}/><span>{label}</span></div><strong>{value}<small>%</small></strong><i><b style={{width:`${value}%`}}/></i><small>{value>=90?"Excellent":value>=84?"Strong":value>=80?"On target":"Focus area"}</small></Card>)}</div></section>
    <section className="result-analysis-grid"><Card className="replay-card"><div className="card-heading"><div><p className="eyebrow">Movement analysis</p><h2>Tool trajectory replay</h2></div><Badge tone="blue">3 events</Badge></div><TrajectoryReplay/></Card><Card className="timeline-card"><div className="card-heading"><div><p className="eyebrow">Session events</p><h2>Error timeline</h2></div></div><div className="error-timeline">{errors.map(([time,title,text,tone])=><div className={`error-event ${tone}`} key={time}><span className="event-time mono">{time}</span><i/><div><strong>{title}</strong><p>{text}</p></div></div>)}</div></Card></section>
    <section className="feedback-comparison-grid"><Card className="feedback-card"><div className="feedback-title"><span><WandSparkles size={18}/></span><div><p className="eyebrow">AI-generated feedback</p><h2>Your next best move</h2></div></div><div className="feedback-grid"><div><span className="feedback-tag green">Strongest area</span><strong>Safety-zone awareness</strong><p>You maintained excellent safety-zone awareness and consistent hand stability throughout most of the attempt.</p></div><div><span className="feedback-tag amber">Main improvement</span><strong>Needle exit alignment</strong><p>Your exit point was positioned too far from the incision line, adding unnecessary correction movement.</p></div><div><span className="feedback-tag cyan">Recommended exercise</span><strong>Entry-to-exit drill × 3</strong><p>Repeat the alignment drill three times while keeping the tool angle between 45° and 60°.</p></div></div><div className="feedback-note"><Sparkles size={14}/><span>This is simulated educational feedback—not clinical assessment or certification.</span></div></Card><Card className="comparison-card"><div className="card-heading"><div><p className="eyebrow">Attempt comparison</p><h2>Progress against baseline</h2></div></div><ComparisonChart/></Card></section>
    <div className="result-actions"><ButtonLink href="/dashboard" variant="ghost"><ArrowLeft size={15}/>Return to dashboard</ButtonLink><div><ButtonLink href="/progress" variant="secondary">View detailed analysis <ArrowRight size={15}/></ButtonLink><ButtonLink href="/training/suture"><RotateCcw size={15}/>Retry scenario</ButtonLink></div></div>
  </div>;
}
