"use client";

import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { Focus, RotateCcw, ScanLine } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SceneErrorBoundary } from "./SceneErrorBoundary";
import { SafeMedicalGLB } from "@/components/simulation/ModelRegistry";
import { MODEL_PATHS } from "@/data/modelConfig";

const instruments = [
  { id: "holder", name: "Needle holder", use: "Control a curved needle during suturing", grip: "Ring handles", tip: "Crosshatched jaw", mistake: "Gripping too close to the hinge" },
  { id: "forceps", name: "Forceps", use: "Hold and manipulate simulated tissue", grip: "Spring handle", tip: "Fine teeth", mistake: "Applying excessive pressure" },
  { id: "scissors", name: "Surgical scissors", use: "Controlled material cutting", grip: "Finger rings", tip: "Curved blades", mistake: "Cutting outside the visual field" },
  { id: "needle", name: "Curved needle", use: "Pass suture through the practice pad", grip: "Mid-body", tip: "Taper point", mistake: "Gripping near the active tip" },
];

export function InstrumentViewer() {
  const [active, setActive] = useState("holder");
  const [part, setPart] = useState("Tip");
  const [explode, setExplode] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const instrument = instruments.find(item => item.id === active)!;
  return (
    <section className="instrument-section">
      <div className="instrument-head"><div><p className="eyebrow">Instrument lab</p><h2>Understand the tool before the movement.</h2><p>Rotate the project&apos;s detailed instrument models and select functional zones to learn correct handling.</p></div><Badge tone="blue">Interactive 3D</Badge></div>
      <div className="instrument-layout">
        <div className="instrument-list">
          {instruments.map(item => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => { setActive(item.id); setPart("Tip"); }}><span className={`instrument-thumb ${item.id}`}><i /><b /></span><div><strong>{item.name}</strong><small>{item.use}</small></div></button>)}
        </div>
        <div className="instrument-stage panel">
          <div className="instrument-stage-toolbar"><span>{instrument.name} · Inspection</span><div><button className={explode ? "active" : ""} onClick={() => setExplode(!explode)}><ScanLine size={13} />Exploded</button><button onClick={() => setPart("Tip")}><Focus size={13} />Tip</button><button onClick={() => setCameraKey(k => k + 1)} aria-label="Reset instrument view"><RotateCcw size={13} /></button></div></div>
          <SceneErrorBoundary><Canvas camera={{ position: [0, 0, 5.3], fov: 38 }} dpr={[1,1.5]}><color attach="background" args={["#eaf3f8"]} /><ambientLight intensity={1.8} /><directionalLight position={[3,4,5]} intensity={2.5} color="#d7f7ff" /><directionalLight position={[-3,-2,2]} intensity={1} color="#2d7ac4" /><Suspense fallback={<Html center>Loading tool…</Html>}><LoadedInstrumentModel type={active} selectedPart={part} onSelect={setPart} explode={explode} /></Suspense><OrbitControls key={cameraKey} enablePan={false} minDistance={3.3} maxDistance={7} /></Canvas></SceneErrorBoundary>
          <div className="instrument-part-tabs" role="group" aria-label="Instrument parts">{["Grip zone","Joint","Jaw","Tip"].map(item => <button key={item} className={part === item ? "active" : ""} onClick={() => setPart(item)}>{item}</button>)}</div>
        </div>
        <div className="instrument-info panel"><p className="eyebrow">Selected instrument</p><h3>{instrument.name}</h3><dl><div><dt>Primary use</dt><dd>{instrument.use}</dd></div><div><dt>Grip area</dt><dd>{instrument.grip}</dd></div><div><dt>Active tip</dt><dd>{instrument.tip}</dd></div><div><dt>Common handling mistake</dt><dd className="text-warning">{instrument.mistake}</dd></div></dl><div className="selected-part"><span>Current selection</span><strong>{part}</strong><p>{part === "Grip zone" ? "Position fingers lightly within the rings for stable, economical movement." : part === "Joint" ? "The joint translates handle pressure into controlled jaw movement." : part === "Jaw" ? "The jaw secures the needle without unnecessary force." : "Keep the active tip in view and away from no-touch zones."}</p></div></div>
      </div>
    </section>
  );
}

function ToolMaterial({ active = false }: { active?: boolean }) { return <meshStandardMaterial color={active ? "#35d9e5" : "#bac7cc"} metalness={.78} roughness={.24} emissive={active ? "#20a6b0" : "#000"} emissiveIntensity={active ? .35 : 0} />; }

const instrumentAssets: Record<string, { path: string; rotation: [number,number,number] }> = {
  holder: { path: MODEL_PATHS.needleHolder, rotation: [0,0,0] },
  forceps: { path: MODEL_PATHS.forceps, rotation: [Math.PI/2,0,0] },
  scissors: { path: MODEL_PATHS.scissors, rotation: [0,0,Math.PI/2] },
  needle: { path: MODEL_PATHS.curvedNeedle, rotation: [Math.PI/2,0,0] },
};

function LoadedInstrumentModel({ type, selectedPart, onSelect, explode }: { type: string; selectedPart: string; onSelect: (part: string) => void; explode: boolean }) {
  const asset = instrumentAssets[type];
  const markerOffset = explode ? .16 : 0;
  return <group>
    <group rotation={asset.rotation} onClick={e => { e.stopPropagation(); onSelect("Tip"); }}>
      <SafeMedicalGLB path={asset.path} targetSize={3.25} color="#bec9cd" metalness={.86} roughness={.2} preserveTextures={false} emissive={selectedPart === "Tip" ? "#164e56" : "#000000"} emissiveIntensity={selectedPart === "Tip" ? .18 : 0} fallback={<InstrumentModel type={type} selectedPart={selectedPart} onSelect={onSelect} explode={explode} />} />
    </group>
    <PartMarker part="Grip zone" position={[-markerOffset,-1.2,.22]} selected={selectedPart} onSelect={onSelect} />
    <PartMarker part="Joint" position={[markerOffset,.05,.22]} selected={selectedPart} onSelect={onSelect} />
    <PartMarker part="Jaw" position={[-markerOffset,.88,.22]} selected={selectedPart} onSelect={onSelect} />
    <PartMarker part="Tip" position={[markerOffset,1.5,.22]} selected={selectedPart} onSelect={onSelect} />
  </group>;
}

function PartMarker({ part, position, selected, onSelect }: { part:string;position:[number,number,number];selected:string;onSelect:(part:string)=>void }) {
  const active = selected === part;
  return <mesh position={position} onClick={e => { e.stopPropagation(); onSelect(part); }} onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
    <sphereGeometry args={[active ? .105 : .075,18,14]} />
    <meshStandardMaterial color={active ? "#5ce2ec" : "#4f6974"} emissive={active ? "#1aa5b0" : "#102832"} emissiveIntensity={active ? .65 : .25} transparent opacity={active ? .95 : .72} />
    {active && <Html center position={[.42,.08,0]}><span className="anatomy-label">{part}</span></Html>}
  </mesh>;
}

function InstrumentModel({ type, selectedPart, onSelect, explode }: { type: string; selectedPart: string; onSelect: (part: string) => void; explode: boolean }) {
  if (type === "needle") return <group rotation={[0,0,.35]}><mesh onClick={() => onSelect("Tip")}><torusGeometry args={[1.25,.055,12,64,Math.PI*1.2]} /><ToolMaterial active={selectedPart === "Tip"} /></mesh><mesh position={[-1.01,-.71,0]} rotation={[0,0,-.5]} onClick={() => onSelect("Grip zone")}><coneGeometry args={[.1,.38,12]} /><ToolMaterial active={selectedPart === "Grip zone"} /></mesh></group>;
  if (type === "forceps") return <group rotation={[0,0,-.2]}><mesh position={[-.18,0,0]} rotation={[0,0,-.06]} onClick={() => onSelect("Grip zone")}><boxGeometry args={[.13,3.1,.12]} /><ToolMaterial active={selectedPart === "Grip zone"} /></mesh><mesh position={[.18,0,0]} rotation={[0,0,.06]} onClick={() => onSelect("Grip zone")}><boxGeometry args={[.13,3.1,.12]} /><ToolMaterial active={selectedPart === "Grip zone"} /></mesh><mesh position={[-.1,1.63,0]} onClick={() => onSelect("Tip")}><coneGeometry args={[.09,.45,8]} /><ToolMaterial active={selectedPart === "Tip"} /></mesh><mesh position={[.1,1.63,0]} onClick={() => onSelect("Tip")}><coneGeometry args={[.09,.45,8]} /><ToolMaterial active={selectedPart === "Tip"} /></mesh></group>;
  const scissor = type === "scissors";
  const shift = explode ? .22 : 0;
  return <group rotation={[0,0,-.45]} scale={.92}><mesh position={[-.36-shift,-1.2,0]} onClick={() => onSelect("Grip zone")}><torusGeometry args={[.34,.095,12,32]} /><ToolMaterial active={selectedPart === "Grip zone"} /></mesh><mesh position={[.36+shift,-1.2,0]} onClick={() => onSelect("Grip zone")}><torusGeometry args={[.34,.095,12,32]} /><ToolMaterial active={selectedPart === "Grip zone"} /></mesh><mesh position={[-.17-shift/2,-.1,0]} rotation={[0,0,-.05]} onClick={() => onSelect("Jaw")}><boxGeometry args={[.13,2.1,.13]} /><ToolMaterial active={selectedPart === "Jaw"} /></mesh><mesh position={[.17+shift/2,-.1,0]} rotation={[0,0,.05]} onClick={() => onSelect("Jaw")}><boxGeometry args={[.13,2.1,.13]} /><ToolMaterial active={selectedPart === "Jaw"} /></mesh><mesh position={[0,.48,.12]} rotation={[Math.PI/2,0,0]} onClick={() => onSelect("Joint")}><cylinderGeometry args={[.16,.16,.22,20]} /><ToolMaterial active={selectedPart === "Joint"} /></mesh>{scissor ? <><mesh position={[-.15,1.35,0]} rotation={[0,0,-.04]} onClick={() => onSelect("Tip")}><boxGeometry args={[.12,1.7,.07]} /><ToolMaterial active={selectedPart === "Tip"} /></mesh><mesh position={[.15,1.35,0]} rotation={[0,0,.04]} onClick={() => onSelect("Tip")}><boxGeometry args={[.12,1.7,.07]} /><ToolMaterial active={selectedPart === "Tip"} /></mesh></> : <><mesh position={[-.1,1.32,0]}><boxGeometry args={[.16,1.55,.18]} /><ToolMaterial active={selectedPart === "Jaw"} /></mesh><mesh position={[.1,1.32,0]}><boxGeometry args={[.16,1.55,.18]} /><ToolMaterial active={selectedPart === "Tip"} /></mesh></>}</group>;
}
