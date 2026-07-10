"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock3, Filter, Play, Search, SlidersHorizontal, Target } from "lucide-react";
import { scenarios } from "@/data/mockData";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export function ScenarioLibrary({ compact = false }: { compact?: boolean }) {
  const [difficulty, setDifficulty] = useState("All");
  const [duration, setDuration] = useState("Any");
  const [query, setQuery] = useState("");
  const [completedOnly, setCompletedOnly] = useState(false);
  const filtered = useMemo(() => scenarios.filter(s =>
    (difficulty === "All" || s.difficulty === difficulty) &&
    (duration === "Any" || (duration === "Short" ? s.duration <= 10 : s.duration > 10)) &&
    (!completedOnly || s.progress >= 75) &&
    s.name.toLowerCase().includes(query.toLowerCase())
  ), [difficulty, duration, completedOnly, query]);

  const remember = (id: string) => {
    try { localStorage.setItem("surgify:lastScenario", id); } catch { /* Local persistence is optional. */ }
  };

  return (
    <div className={cn("scenario-library", compact && "compact")}>
      <div className="scenario-toolbar">
        <label className="scenario-search"><Search size={15} /><span className="sr-only">Search scenarios</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search scenarios" /></label>
        <div className="filter-group"><Filter size={14} /><span>Difficulty</span><select aria-label="Filter by difficulty" value={difficulty} onChange={e => setDifficulty(e.target.value)}><option>All</option><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></div>
        <div className="filter-group"><Clock3 size={14} /><span>Duration</span><select aria-label="Filter by duration" value={duration} onChange={e => setDuration(e.target.value)}><option>Any</option><option>Short</option><option>Extended</option></select></div>
        <button className={cn("completed-filter", completedOnly && "active")} onClick={() => setCompletedOnly(!completedOnly)} aria-pressed={completedOnly}><SlidersHorizontal size={14} /> Completed</button>
      </div>
      <div className="scenario-card-grid">
        {filtered.map((scenario, index) => {
          const link = scenario.id === "suture" ? "/training/suture" : `/training?scenario=${scenario.id}`;
          return (
            <article className="training-scenario-card panel" key={scenario.id}>
              <div className={`training-scenario-art scenario-art-${index + 1}`}>
                <span className="art-label"><i /> Interactive preview</span><div className="art-object"><i /><b /><em /></div>
                <span className="art-number">0{index + 1}</span>
              </div>
              <div className="training-scenario-copy">
                <div className="scenario-meta"><Badge tone={scenario.difficulty === "Beginner" ? "green" : scenario.difficulty === "Intermediate" ? "blue" : "amber"}>{scenario.difficulty}</Badge><span><Clock3 size={12} /> {scenario.duration} min</span></div>
                <h2>{scenario.name}</h2><p>{scenario.description}</p>
                <div className="scenario-skills"><span><Target size={12} /> Skills focus</span><div>{scenario.skills.slice(0, compact ? 2 : 3).map(skill => <Badge key={skill} tone="slate">{skill}</Badge>)}</div></div>
                <div className="scenario-progress"><div><span>Course progress</span><strong>{scenario.progress}%</strong></div><i><b style={{ width: `${scenario.progress}%` }} /></i></div>
                <Link href={link} className="button button-secondary button-md" onClick={() => remember(scenario.id)}>Start scenario <Play size={14} fill="currentColor" /></Link>
              </div>
            </article>
          );
        })}
      </div>
      {filtered.length === 0 && <div className="empty-scenarios panel"><Search size={25} /><h3>No matching scenarios</h3><p>Try changing the filters or search term.</p></div>}
    </div>
  );
}
