"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity, ArrowRight, BarChart3, BrainCircuit, Camera, Check, ChevronRight,
  Crosshair, Laptop, Layers3, MoveUpRight, ShieldCheck, Sparkles, Target,
} from "lucide-react";
import { Brand } from "@/components/ui/Brand";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { scenarios, medicalDisclaimer } from "@/data/mockData";
import "./landing.css";

const features = [
  { icon: Camera, title: "Webcam Skill Tracking", text: "Simulated hand and instrument tracking turns everyday hardware into a guided practice station.", stat: "96%", label: "demo confidence" },
  { icon: Layers3, title: "Interactive 3D Anatomy", text: "Explore layered structures and connect anatomy context to each training exercise.", stat: "7", label: "learning layers" },
  { icon: BrainCircuit, title: "Real-Time AI Coaching", text: "Receive timely, specific prompts about angle, movement, sequence, and safety.", stat: "Live", label: "guidance loop" },
  { icon: BarChart3, title: "Performance Analytics", text: "See progress across attempts and understand the movements that shape each score.", stat: "+14%", label: "monthly growth" },
];

function HeroVisual() {
  return (
    <motion.div className="hero-product" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, delay: .18 }}>
      <div className="hero-product-top">
        <div><span className="window-dot" /><span className="window-dot" /><span className="window-dot" /></div>
        <span className="hero-product-title">Simple Interrupted Suture</span>
        <span className="recording-state"><i /> Demo feed</span>
      </div>
      <div className="hero-product-body">
        <div className="mini-sidebar">
          <div className="mini-logo" />
          {[1,2,3,4,5].map((item) => <span key={item} className={item === 2 ? "active" : ""} />)}
        </div>
        <div className="hero-feed">
          <div className="feed-grid" />
          <div className="practice-pad">
            <div className="incision-line" />
            <span className="entry-marker">ENTRY</span>
            <span className="exit-marker">EXIT</span>
            <div className="trajectory-line" />
            <div className="tool-shaft"><span /></div>
            <div className="tracking-box" />
            {[...Array(8)].map((_, i) => <i key={i} className={`hand-dot hand-dot-${i + 1}`} />)}
          </div>
          <div className="feed-label"><Crosshair size={12} />Approaching entry zone</div>
          <div className="confidence-label">Tracking confidence <strong>96%</strong></div>
        </div>
        <div className="hero-metrics">
          <span className="metrics-label">Live performance</span>
          <div className="hero-score"><span>Score</span><strong>82</strong><small>/100</small></div>
          {[['Accuracy',84],['Efficiency',76],['Safety',92]].map(([label, value]) => (
            <div className="mini-metric" key={String(label)}><div><span>{label}</span><strong>{value}</strong></div><i><b style={{ width: `${value}%` }} /></i></div>
          ))}
          <div className="mini-anatomy">
            <span className="mini-torso"><i /><b /></span>
            <div><small>Anatomy focus</small><strong>Skin layer</strong><em>Entry depth</em></div>
          </div>
        </div>
      </div>
      <div className="performance-float">
        <div><span>Performance trend</span><strong>Improving</strong></div>
        <div className="sparkline">{[28,35,31,44,49,47,62,68].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
        <Badge tone="green">+6 points</Badge>
      </div>
    </motion.div>
  );
}

export default function Home() {
  return (
    <div className="landing-page">
      <header className="landing-nav shell-width">
        <Brand />
        <nav aria-label="Landing page navigation">
          <a href="#features">Features</a><a href="#workflow">How it works</a><a href="#scenarios">Scenarios</a><Link href="/anatomy">Anatomy Lab</Link>
        </nav>
        <ButtonLink href="/dashboard" size="sm">Launch prototype <ArrowRight size={14} /></ButtonLink>
      </header>

      <main>
        <section className="landing-hero shell-width">
          <div className="hero-copy">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }}>
              <div className="hero-kicker"><span><Sparkles size={13} /></span> Accessible surgical skills training</div>
              <h1>AI-powered surgical training.<br /><em>No headset required.</em></h1>
              <p>Surgify AI turns a standard webcam and low-cost practice kit into an intelligent training assistant—helping every movement become more deliberate.</p>
              <div className="hero-actions">
                <ButtonLink href="/dashboard" size="lg">Launch Prototype <ArrowRight size={17} /></ButtonLink>
                <ButtonLink href="/training" variant="secondary" size="lg">Explore Training <Activity size={17} /></ButtonLink>
              </div>
              <div className="hero-proof">
                <span><Check size={13} /> No special hardware</span><span><Check size={13} /> Simulated AI guidance</span><span><Check size={13} /> Frontend prototype</span>
              </div>
            </motion.div>
          </div>
          <HeroVisual />
        </section>

        <section id="features" className="landing-section shell-width">
          <div className="landing-section-head">
            <div><p className="eyebrow">The learning loop</p><h2>Better feedback for every movement.</h2></div>
            <p>One connected practice environment from anatomical orientation to measured performance review.</p>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, text, stat, label }, i) => (
              <motion.article className="landing-card feature-card" key={title} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .06 }}>
                <div className="feature-card-top"><span className="feature-icon"><Icon size={19} /></span><MoveUpRight size={16} /></div>
                <h3>{title}</h3><p>{text}</p><div className="feature-stat"><strong>{stat}</strong><span>{label}</span></div>
              </motion.article>
            ))}
          </div>
        </section>

        <section id="workflow" className="workflow-section">
          <div className="shell-width">
            <div className="landing-section-head"><div><p className="eyebrow">How it works</p><h2>A focused loop from practice to progress.</h2></div></div>
            <div className="workflow-grid">
              {[
                ["01", "Select a scenario", "Choose a targeted exercise and review its skills focus before you begin.", Target],
                ["02", "Practise with your webcam", "Follow visual landmarks while simulated tracking measures tool movement.", Camera],
                ["03", "Review your performance", "Compare scores, replay the trajectory, and turn feedback into the next drill.", BarChart3],
              ].map(([num, title, text, Icon], i) => {
                const StepIcon = Icon as typeof Target;
                return <div className="workflow-step" key={String(num)}><span className="workflow-num">{String(num)}</span><div className="workflow-icon"><StepIcon size={22} /></div><h3>{String(title)}</h3><p>{String(text)}</p>{i < 2 && <ChevronRight className="workflow-arrow" />}</div>;
              })}
            </div>
          </div>
        </section>

        <section id="scenarios" className="landing-section shell-width">
          <div className="landing-section-head"><div><p className="eyebrow">Practice library</p><h2>Start with foundational scenarios.</h2></div><ButtonLink href="/scenarios" variant="ghost">View all scenarios <ArrowRight size={15} /></ButtonLink></div>
          <div className="scenario-preview-grid">
            {scenarios.map((scenario, index) => (
              <Link href={scenario.id === "suture" ? "/training/suture" : "/training"} className="landing-card scenario-preview" key={scenario.id}>
                <div className={`scenario-art scenario-art-${index + 1}`}><span /><i /><b /></div>
                <div className="scenario-preview-copy"><Badge tone={scenario.difficulty === "Beginner" ? "green" : scenario.difficulty === "Intermediate" ? "blue" : "amber"}>{scenario.difficulty}</Badge><span>{scenario.duration} min</span><h3>{scenario.name}</h3><p>{scenario.skills.slice(0,2).join(" · ")}</p></div>
              </Link>
            ))}
          </div>
        </section>

        <section className="access-section shell-width">
          <div className="access-copy"><p className="eyebrow">Built for broader access</p><h2>Clinical skills practice should not depend on expensive hardware.</h2><p>Surgify AI is designed around equipment students already have, making structured practice more approachable in low-resource training environments.</p><ButtonLink href="/dashboard" size="lg">Explore the prototype <ArrowRight size={17} /></ButtonLink></div>
          <div className="access-grid">
            {[[ShieldCheck,"No VR headset","Practise without immersive hardware."],[Laptop,"Runs on a laptop","Designed around a standard browser."],[Target,"Low-cost setup","Pair with a simple physical practice pad."],[Layers3,"Flexible learning","Use in labs, classrooms, or at home."]].map(([Icon,title,text]) => { const I = Icon as typeof Laptop; return <div className="access-item" key={String(title)}><I size={20} /><div><strong>{String(title)}</strong><span>{String(text)}</span></div></div>; })}
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="shell-width"><div><Brand /><span className="hackathon-label">Hackathon project · Frontend prototype</span></div><p>{medicalDisclaimer}</p></div>
      </footer>
    </div>
  );
}
