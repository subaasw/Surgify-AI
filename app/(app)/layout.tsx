import type { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { medicalDisclaimer } from "@/data/mockData";
import "./shell.css";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <AppSidebar />
      <MobileNav />
      <main className="app-main">
        {children}
        <footer className="app-footer">
          <span>Hackathon prototype · v0.9</span>
          <p>{medicalDisclaimer}</p>
        </footer>
      </main>
    </div>
  );
}
