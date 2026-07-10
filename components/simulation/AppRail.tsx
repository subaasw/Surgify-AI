"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Boxes, CircleGauge, FlaskConical, Settings, Stethoscope } from "lucide-react";
import { Brand } from "@/components/ui/Brand";
import { cn } from "@/lib/utils";

const links = [
  { href: "/simulation", label: "Simulation", icon: Activity },
  { href: "/scenarios", label: "Scenarios", icon: Boxes },
  { href: "/anatomy", label: "Anatomy", icon: Stethoscope },
  { href: "/instruments", label: "Instruments", icon: FlaskConical },
  { href: "/results", label: "Results", icon: CircleGauge },
];

export function AppRail() {
  const pathname = usePathname();
  return <aside className="app-rail"><div className="rail-logo"><Brand compact href="/simulation" /></div><nav aria-label="Application navigation">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn("rail-link", pathname === href && "active")} aria-label={label}><Icon size={18} /><span>{label}</span></Link>)}</nav><Link href="/settings" className={cn("rail-link rail-settings", pathname === "/settings" && "active")} aria-label="Settings"><Settings size={18} /><span>Settings</span></Link><div className="rail-avatar">MS<span>Dr. Maya Sharma</span></div></aside>;
}
