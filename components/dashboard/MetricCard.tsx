"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/Card";

export function MetricCard({ label, value, unit, change, icon: Icon, index = 0 }: { label: string; value: string | number; unit?: string; change: string; icon: LucideIcon; index?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .05 }}>
      <Card className="metric-card">
        <div className="metric-card-top"><span className="metric-icon"><Icon size={18} /></span><span className="metric-change"><ArrowUpRight size={12} />{change}</span></div>
        <div className="metric-value"><strong>{value}</strong>{unit && <span>{unit}</span>}</div>
        <p>{label}</p>
        <div className="metric-spark">{[32,45,39,54,50,65,72,80].map((h,i) => <i key={i} style={{height:`${h}%`}} />)}</div>
      </Card>
    </motion.div>
  );
}
