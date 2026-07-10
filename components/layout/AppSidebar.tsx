"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, BadgeCheck, BookOpen, Boxes, ChevronRight, LayoutDashboard,
  Microscope, Settings, Stethoscope, TrendingUp,
} from "lucide-react";
import { Brand } from "@/components/ui/Brand";
import { cn } from "@/lib/utils";

const nav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Training", href: "/training", icon: Activity },
  { label: "Anatomy Lab", href: "/anatomy", icon: Microscope },
  { label: "Scenarios", href: "/scenarios", icon: Boxes },
  { label: "Results", href: "/results", icon: BadgeCheck },
  { label: "Progress", href: "/progress", icon: TrendingUp },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand"><Brand /></div>
      <nav className="sidebar-nav" aria-label="Primary navigation">
        <p className="sidebar-label">Workspace</p>
        {nav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
          return (
            <Link key={item.href} href={item.href} className={cn("sidebar-link", active && "active")}>
              <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
              <span>{item.label}</span>
              {active && <span className="active-pip" />}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-support panel-inset">
        <BookOpen size={17} aria-hidden="true" />
        <div><strong>Practice library</strong><span>12 guided exercises</span></div>
        <ChevronRight size={15} aria-hidden="true" />
      </div>
      <div className="sidebar-profile">
        <div className="avatar avatar-maya">MS</div>
        <div className="sidebar-profile-copy">
          <strong>Dr. Maya Sharma</strong>
          <span>Medical Student · Intermediate</span>
        </div>
        <Stethoscope size={16} aria-hidden="true" />
      </div>
    </aside>
  );
}
