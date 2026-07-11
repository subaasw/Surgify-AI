"use client";
/* eslint-disable @next/next/no-img-element -- local JPEGs bypass vinext's unavailable image optimization binding. */

import Link from "next/link";
import { Activity, ArrowRight, Clock3, LockKeyhole, Play, Search, Target } from "lucide-react";
import { useState } from "react";
import { scenarioTiles } from "@/data/simulationData";
import { Badge } from "@/components/ui/Badge";
import "./scenarios.css";

type ScenarioTile = (typeof scenarioTiles)[number];

export default function ScenariosPage() {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const shown = scenarioTiles.filter(item => (filter === "All" || item.difficulty === filter) && `${item.name} ${item.condition} ${item.skills.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="app-page scenario-launcher">
    <header className="app-page-header"><div><h1>Scenario library</h1><p>Choose a focused clinical training mission.</p></div><div className="app-page-header-actions"><label className="scenario-app-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search scenarios" aria-label="Search scenarios" /></label></div></header>
    <div className="app-page-content">
      <div className="launcher-toolbar"><div><span>Clinical skills curriculum</span><strong>{shown.length} scenario{shown.length === 1 ? "" : "s"}</strong></div><div role="group" aria-label="Filter scenarios by difficulty">{["All", "Beginner", "Intermediate"].map(item => <button key={item} aria-pressed={filter === item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
      {shown.length ? <div className="launcher-grid">{shown.map(scenario => <ScenarioCard scenario={scenario} key={scenario.id} />)}</div> : <div className="launcher-empty"><Search size={22} /><strong>No matching scenarios</strong><span>Try a different skill or difficulty.</span></div>}
    </div>
  </div>;
}

function ScenarioCard({ scenario }: { scenario: ScenarioTile }) {
  const index = scenarioTiles.indexOf(scenario) + 1;
  const content = <><div className="launcher-scene"><img src={scenario.image} alt={`${scenario.name} training preview`} width="1200" height="675" /><span className="launcher-index">{String(index).padStart(2, "0")}</span><span className={`tile-status ${scenario.playable ? "ready" : "locked"}`}><i />{scenario.status}</span></div><div className="launcher-copy"><div className="launcher-meta"><Badge tone={scenario.difficulty === "Beginner" ? "green" : "amber"}>{scenario.difficulty}</Badge><span><Clock3 size={13} />{scenario.duration} min</span></div><h2>{scenario.name}</h2><p>{scenario.condition}</p><div className="launcher-skills"><span><Target size={13} />Skills trained</span><div>{scenario.skills.map(skill => <small key={skill}>{skill}</small>)}</div></div><div className="launcher-progress"><div><span>{scenario.playable ? "Attempt status" : "Curriculum status"}</span><strong>{scenario.playable ? "Not started" : "Preview"}</strong></div><i><b style={{ width: `${scenario.progress}%` }} /></i></div><span className="launch-scenario">{scenario.playable ? <Play size={15} fill="currentColor" /> : <LockKeyhole size={15} />} {scenario.playable ? "Start simulation" : "Coming soon"}{scenario.playable ? <ArrowRight size={15} /> : <Activity size={15} />}</span></div></>;
  return scenario.playable
    ? <Link href={`/simulation?scenario=${scenario.id}`} className="launcher-tile" aria-label={`Start ${scenario.name}`}>{content}</Link>
    : <article className="launcher-tile unavailable" aria-label={`${scenario.name}, coming soon`}>{content}</article>;
}
