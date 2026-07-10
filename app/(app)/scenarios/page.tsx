import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { ScenarioLibrary } from "@/components/training/ScenarioLibrary";
import "../training/training.css";

export default function ScenariosPage() {
  return <div className="page-wrap training-library-page"><DashboardHeader title="Scenario library" description="Explore exercises by difficulty, skills focus, duration, and completion status." /><ScenarioLibrary /></div>;
}
