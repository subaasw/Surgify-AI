"use client";

import { Bell, Flame, Search } from "lucide-react";

export function DashboardHeader({ title = "Good morning, Maya", description = "Ready for another focused practice session?" }: { title?: string; description?: string }) {
  return (
    <header className="dashboard-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="dashboard-header-actions">
        <label className="header-search"><Search size={16} /><span className="sr-only">Search training</span><input placeholder="Search training" /></label>
        <div className="streak-pill"><Flame size={16} fill="currentColor" /><strong>7 day</strong><span>streak</span></div>
        <button className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><span /></button>
        <div className="avatar avatar-maya" aria-label="Maya Sharma profile">MS</div>
      </div>
    </header>
  );
}
