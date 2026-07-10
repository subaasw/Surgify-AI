"use client";

import { CheckCircle2, ScanLine, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function CalibrationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="calibration-modal panel" role="dialog" aria-modal="true" aria-labelledby="cal-title" onMouseDown={e => e.stopPropagation()}><button className="modal-close" aria-label="Close calibration" onClick={onClose}><X size={17} /></button><div className="calibration-icon"><ScanLine size={23} /></div><h2 id="cal-title">Camera calibration</h2><p>Keep the practice pad inside the frame and make sure all four corner markers are visible.</p><div className="calibration-preview"><span /><span /><span /><span /><div><CheckCircle2 size={20} />Practice area detected</div></div><div className="calibration-checks"><span><CheckCircle2 size={14} /> Lighting sufficient</span><span><CheckCircle2 size={14} /> Scale marker found</span><span><CheckCircle2 size={14} /> Work area centered</span></div><Button onClick={onClose}>Save calibration</Button></div></div>;
}
