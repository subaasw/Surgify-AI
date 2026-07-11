"use client";
/* eslint-disable @next/next/no-img-element -- local JPEGs bypass vinext's unavailable image optimization binding. */

import Link from "next/link";
import { Activity, ArrowRight, Clock3, LockKeyhole, Play, Search, ShieldCheck, Target } from "lucide-react";
import { useState } from "react";
import { scenarioTiles } from "@/data/simulationData";
import { Badge } from "@/components/ui/Badge";
import "./scenarios.css";

type ScenarioTile = (typeof scenarioTiles)[number];

export default function ScenariosPage() {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(scenarioTiles[0].id);
  const shown = scenarioTiles.filter(item => (filter === "All" || item.difficulty === filter) && `${item.name} ${item.condition} ${item.skills.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const active = shown.find(item => item.id === activeId) ?? shown[0] ?? scenarioTiles[0];

  return <div className="app-page scenario-launcher">
    <img className="launcher-backdrop" src={active.image} alt="" aria-hidden="true" />
    <div className="launcher-atmosphere" aria-hidden="true" />
    <header className="scenario-topbar scenario-glass">
      <div><span className="scenario-live"><i />Clinical simulation library</span><h1>Scenario library</h1><p>Choose a focused clinical training mission.</p></div>
      <label className="scenario-app-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search scenarios" aria-label="Search scenarios" /></label>
    </header>

    <main className="launcher-stage">
      <section className="launcher-intro" aria-labelledby="launcher-heading">
        <div><span className="launcher-kicker"><Activity size={15} />Surgify training pathways</span><h2 id="launcher-heading">Enter the clinical environment</h2><p>Select a case to review its training focus, skills, and expected duration.</p></div>
        <div className="launcher-toolbar scenario-glass"><div><span>Available missions</span><strong>{shown.length} scenario{shown.length === 1 ? "" : "s"}</strong></div><div role="group" aria-label="Filter scenarios by difficulty">{["All", "Beginner", "Intermediate"].map(item => <button key={item} aria-pressed={filter === item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
      </section>

      {shown.length ? <div className="launcher-grid">{shown.map(scenario => <ScenarioCard scenario={scenario} key={scenario.id} active={active.id === scenario.id} onPreview={() => setActiveId(scenario.id)} />)}</div> : <div className="launcher-empty scenario-glass"><Search size={25} /><strong>No matching scenarios</strong><span>Try a different skill or difficulty.</span></div>}

      <footer className="launcher-note scenario-glass"><ShieldCheck size={16} /><span><strong>Guided clinical practice</strong> · Fictional patients and educational simulations only</span><span>{active.name} · {active.duration} min</span></footer>
    </main>
  </div>;
}

function ScenarioCard({ scenario, active, onPreview }: { scenario: ScenarioTile; active: boolean; onPreview: () => void }) {
  const index = scenarioTiles.indexOf(scenario) + 1;
  const content = <>
    <div className="launcher-scene"><img src={scenario.image} alt={`${scenario.name} training preview`} width="1200" height="675" /><span className="launcher-index">{String(index).padStart(2, "0")}</span><span className={`tile-status ${scenario.playable ? "ready" : "locked"}`}><i />{scenario.status}</span><div className="launcher-meta"><Badge tone={scenario.difficulty === "Beginner" ? "green" : "amber"}>{scenario.difficulty}</Badge><span><Clock3 size={13} />{scenario.duration} min</span></div></div>
    <div className="launcher-copy"><h3>{scenario.name}</h3><p>{scenario.condition}</p><div className="launcher-skills"><span><Target size={13} />Skills trained</span><div>{scenario.skills.map(skill => <small key={skill}>{skill}</small>)}</div></div><div className="launcher-progress"><div><span>{scenario.playable ? "Attempt status" : "Curriculum status"}</span><strong>{scenario.playable ? "Not started" : "Preview"}</strong></div><i><b style={{ width: `${scenario.progress}%` }} /></i></div><span className="launch-scenario">{scenario.playable ? <Play size={15} fill="currentColor" /> : <LockKeyhole size={15} />} {scenario.playable ? "Start simulation" : "Coming soon"}{scenario.playable ? <ArrowRight size={15} /> : <Activity size={15} />}</span></div>
  </>;
  return scenario.playable
    ? <Link href={`/simulation?scenario=${scenario.id}`} className={`launcher-tile ${active ? "active" : ""}`} aria-label={`Start ${scenario.name}`} onMouseEnter={onPreview} onFocus={onPreview}>{content}</Link>
    : <article className={`launcher-tile unavailable ${active ? "active" : ""}`} aria-label={`${scenario.name}, coming soon`} tabIndex={0} onMouseEnter={onPreview} onFocus={onPreview}>{content}</article>;
}
