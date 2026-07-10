"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, LayoutDashboard, Activity, Microscope, TrendingUp } from "lucide-react";
import { Brand } from "@/components/ui/Brand";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/training", label: "Training", icon: Activity },
  { href: "/anatomy", label: "Anatomy", icon: Microscope },
  { href: "/progress", label: "Progress", icon: TrendingUp },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mobile-nav">
      <Brand />
      <button className="icon-button" onClick={() => setOpen(!open)} aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open}>
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && (
        <nav className="mobile-nav-menu" aria-label="Mobile navigation">
          {items.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}><Icon size={17} />{label}</Link>
          ))}
          <Link href="/settings" onClick={() => setOpen(false)}><span>MS</span>Profile & settings</Link>
        </nav>
      )}
    </div>
  );
}
