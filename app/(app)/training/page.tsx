import { BookOpenCheck } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { ScenarioLibrary } from "@/components/training/ScenarioLibrary";
import "./training.css";

export default function TrainingPage() {
  return <div className="page-wrap training-library-page"><DashboardHeader title="Training scenarios" description="Choose a focused exercise and turn each attempt into measurable progress." /><div className="library-summary panel"><BookOpenCheck size={19} /><div><strong>Personalized pathway</strong><span>Your next recommended scenario is Simple Interrupted Suture · Level 3</span></div><b>4 of 12 scenarios active</b></div><ScenarioLibrary /></div>;
}
