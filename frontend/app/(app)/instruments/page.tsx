import Link from "next/link";
import { ArrowLeft, Crosshair, MousePointer2 } from "lucide-react";
import { InstrumentViewer } from "@/components/anatomy/InstrumentViewer";
import "../anatomy/anatomy.css";
import "./instruments.css";

export default function InstrumentsPage(){return <div className="app-page instrument-app-page"><header className="app-page-header"><div><h1>Instrument lab</h1><p>Rotate the clinical models and inspect functional zones before the closure exercise.</p></div><div className="app-page-header-actions"><span className="instrument-app-chip"><MousePointer2 size={13}/>Select a labeled part</span><span className="instrument-app-chip"><Crosshair size={13}/>Forearm closure kit</span><Link href="/simulation?scenario=forearm" className="button button-secondary button-sm"><ArrowLeft size={13}/>Return to case</Link></div></header><div className="app-page-content"><InstrumentViewer/></div></div>}
