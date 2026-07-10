import type { ReactNode } from "react";
import { AppRail } from "@/components/simulation/AppRail";
import { SimulationProvider } from "@/components/simulation/SimulationProvider";
import "./shell.css";

export default function SimulationAppLayout({ children }: { children: ReactNode }) {
  return <SimulationProvider><div className="simulation-app"><AppRail /><main className="simulation-main">{children}</main></div></SimulationProvider>;
}
