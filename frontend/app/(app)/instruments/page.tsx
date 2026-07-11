import Link from "next/link";
import { ArrowLeft, Crosshair, MousePointer2 } from "lucide-react";
import { InstrumentViewer } from "@/components/anatomy/InstrumentViewer";
import { Brand } from "@/components/ui/Brand";
import "../anatomy/anatomy.css";
import "./instruments.css";

export default function InstrumentsPage() {
  return <div className="app-page instrument-app-page">
    <header className="app-page-header">
      <div className="instrument-app-title">
        <Brand href="/scenarios" />
        <i />
        <div><span>3D training workspace</span><h1>Instrument lab</h1><p>Inspect handling zones before the closure exercise.</p></div>
      </div>
      <div className="app-page-header-actions">
        <span className="instrument-app-chip"><MousePointer2 size={15}/>Select a labeled part</span>
        <span className="instrument-app-chip"><Crosshair size={15}/>Forearm closure kit</span>
        <Link href="/simulation?scenario=forearm" className="instrument-return"><ArrowLeft size={15}/><span>Return to case</span></Link>
      </div>
    </header>
    <div className="app-page-content"><InstrumentViewer/></div>
  </div>;
}
