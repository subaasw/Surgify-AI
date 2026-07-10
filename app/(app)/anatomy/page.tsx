import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { AnatomyViewer } from "@/components/anatomy/AnatomyViewer";
import { InstrumentViewer } from "@/components/anatomy/InstrumentViewer";
import "./anatomy.css";

export default function AnatomyPage() {
  return <div className="page-wrap anatomy-page"><DashboardHeader title="Anatomy Lab" description="Explore simplified 3D structures and connect anatomical context to procedural skills." /><AnatomyViewer /><InstrumentViewer /></div>;
}
