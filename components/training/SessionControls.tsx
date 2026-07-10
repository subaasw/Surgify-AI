import { Eye, EyeOff, Gauge, Pause, Play, RotateCcw, Sparkles, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function SessionControls({ running, started, overlays, guidance, onStart, onPause, onRestart, onEnd, onToggleOverlays, onToggleGuidance, onCalibrate }: {
  running: boolean; started: boolean; overlays: boolean; guidance: boolean;
  onStart: () => void; onPause: () => void; onRestart: () => void; onEnd: () => void; onToggleOverlays: () => void; onToggleGuidance: () => void; onCalibrate: () => void;
}) {
  return <div className="session-controls panel">
    <div className="control-primary">{running ? <Button variant="secondary" onClick={onPause}><Pause size={15} fill="currentColor" /> Pause</Button> : <Button onClick={onStart}><Play size={15} fill="currentColor" /> {started ? "Resume session" : "Start session"}</Button>}<Button variant="ghost" onClick={onRestart}><RotateCcw size={15} /> Restart</Button><Button variant="danger" onClick={onEnd} disabled={!started}><Square size={13} fill="currentColor" /> End session</Button></div>
    <div className="control-secondary"><Button variant={overlays ? "secondary" : "ghost"} size="sm" onClick={onToggleOverlays}>{overlays ? <Eye size={14} /> : <EyeOff size={14} />} Overlays</Button><Button variant={guidance ? "secondary" : "ghost"} size="sm" onClick={onToggleGuidance}><Sparkles size={14} /> Guidance</Button><Button variant="ghost" size="sm" onClick={onCalibrate}><Gauge size={14} /> Calibrate</Button></div>
  </div>;
}
