import { Layers3, ScanLine } from "lucide-react";
import { AnatomyViewer } from "@/components/anatomy/AnatomyViewer";
import "./anatomy.css";

export default function AnatomyPage() {
  return (
    <div className="app-page anatomy-app-page">
      <header className="app-page-header">
        <div>
          <h1>Interactive anatomy lab</h1>
          <p>Inspect layered structures and relate them to the active forearm procedure.</p>
        </div>
        <div className="app-page-header-actions">
          <span className="anatomy-app-status"><i />3D model ready</span>
          <span className="anatomy-app-mode"><Layers3 size={13} />Layered patient</span>
          <span className="anatomy-app-mode"><ScanLine size={13} />Educational view</span>
        </div>
      </header>
      <div className="app-page-content">
        <AnatomyViewer />
      </div>
    </div>
  );
}
