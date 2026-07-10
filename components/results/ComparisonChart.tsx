"use client";

import { ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, Tooltip, Legend } from "recharts";
import { comparisonData } from "@/data/mockData";

export function ComparisonChart() {
  return <div className="comparison-chart" aria-label="Attempt comparison radar chart"><ResponsiveContainer width="100%" height="100%"><RadarChart data={comparisonData} outerRadius="66%"><PolarGrid stroke="rgba(148,163,184,.16)" /><PolarAngleAxis dataKey="skill" tick={{fill:"#8397ad",fontSize:9}} /><Tooltip contentStyle={{background:"#0e1b2b",border:"1px solid rgba(148,163,184,.2)",borderRadius:9,fontSize:10}} /><Legend iconType="circle" wrapperStyle={{fontSize:10,color:"#8da1b4"}} /><Radar name="Current attempt" dataKey="current" stroke="#29c7d8" fill="#29c7d8" fillOpacity={.18} strokeWidth={2}/><Radar name="Previous attempt" dataKey="previous" stroke="#64748b" fill="#64748b" fillOpacity={.05}/><Radar name="Personal best" dataKey="best" stroke="#22c55e" fill="transparent" strokeDasharray="4 4" /></RadarChart></ResponsiveContainer></div>;
}
