"use client";

import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatTime } from "@/lib/utils";

export function TrajectoryReplay() {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setProgress(p => p >= 100 ? (setPlaying(false), 100) : p + 1), 45);
    return () => clearInterval(id);
  }, [playing]);
  const reset = () => { setPlaying(false); setProgress(0); };
  return <div className="trajectory-replay">
    <div className="replay-stage">
      <div className="replay-grid" /><div className="replay-pad"><span className="replay-incision"/><span className="replay-ideal"/><span className="replay-actual" style={{clipPath:`inset(0 ${100-progress}% 0 0)`}}/><i className="mistake-marker mistake-one">1</i><i className="mistake-marker mistake-two">2</i><i className="mistake-marker mistake-three">3</i><b className="replay-tip" style={{left:`${26 + progress * .47}%`,top:`${50 - Math.sin(progress/17)*22}%`}}/></div>
      <div className="replay-legend"><span><i className="actual"/>Actual path</span><span><i className="ideal"/>Ideal path</span><span><i className="mistake"/>Mistake</span></div>
    </div>
    <div className="replay-controls"><Button variant="secondary" size="sm" onClick={() => setPlaying(!playing)}>{playing?<Pause size={13}/>:<Play size={13} fill="currentColor"/>}{playing?"Pause":"Play replay"}</Button><button onClick={reset} aria-label="Restart replay"><RotateCcw size={14}/></button><span className="mono">{formatTime(progress * 2.22)}</span><input aria-label="Replay timeline" type="range" min="0" max="100" value={progress} onChange={e=>setProgress(Number(e.target.value))}/><span className="mono">03:42</span></div>
  </div>;
}
