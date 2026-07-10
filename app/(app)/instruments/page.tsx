import { Crosshair, MousePointer2 } from "lucide-react";
import { InstrumentViewer } from "@/components/anatomy/InstrumentViewer";
import "../anatomy/anatomy.css";
import "./instruments.css";

export default function InstrumentsPage(){return <div className="app-page instrument-app-page"><header className="app-page-header"><div><h1>Instrument training environment</h1><p>Rotate, inspect, and identify functional zones before entering the procedure.</p></div><div className="app-page-header-actions"><span className="instrument-app-chip"><MousePointer2 size={13}/>Click parts to inspect</span><span className="instrument-app-chip"><Crosshair size={13}/>Positioning exercise ready</span></div></header><div className="app-page-content"><InstrumentViewer/></div></div>}
