"use client";

import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, Tooltip } from "recharts";
import { skillData } from "@/data/mockData";

export function SkillChart() {
  return (
    <div className="skill-chart" aria-label="Skill breakdown radar chart">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={skillData} outerRadius="69%">
          <PolarGrid stroke="rgba(148,163,184,.16)" />
          <PolarAngleAxis dataKey="skill" tick={{ fill: "#8ba0b7", fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "#0e1b2b", border: "1px solid rgba(148,163,184,.2)", borderRadius: 10, fontSize: 11 }} />
          <Radar dataKey="value" stroke="#4fd9e5" fill="#29c7d8" fillOpacity={0.2} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
