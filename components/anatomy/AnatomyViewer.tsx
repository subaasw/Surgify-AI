"use client";

import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Float, Html, OrbitControls } from "@react-three/drei";
import { Eye, EyeOff, Focus, Layers3, RotateCcw, ScanLine } from "lucide-react";
import { anatomyLayers } from "@/data/mockData";
import type { AnatomyLayer } from "@/types";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { SceneErrorBoundary } from "./SceneErrorBoundary";

type LayerState = Record<AnatomyLayer["id"], boolean>;

export function AnatomyViewer() {
  const [visible, setVisible] = useState<LayerState>({ skin: true, muscles: true, skeleton: true, heart: true, lungs: true, liver: true, stomach: true });
  const [selected, setSelected] = useState<AnatomyLayer["id"]>("skin");
  const [exploded, setExploded] = useState(0);
  const [wireframe, setWireframe] = useState(false);
  const [transparent, setTransparent] = useState(true);
  const [labels, setLabels] = useState(true);
  const [region, setRegion] = useState("Thorax");
  const [cameraKey, setCameraKey] = useState(0);
  const selectedLayer = anatomyLayers.find(layer => layer.id === selected)!;
  const toggleLayer = (id: AnatomyLayer["id"]) => setVisible(v => ({ ...v, [id]: !v[id] }));

  return (
    <div className="anatomy-layout">
      <aside className="anatomy-controls panel">
        <div className="anatomy-panel-head"><div><p className="eyebrow">Visibility</p><h2>Anatomy layers</h2></div><Layers3 size={18} /></div>
        <div className="body-regions" role="group" aria-label="Body region">
          {["Thorax", "Abdomen", "Upper limb", "Lower limb"].map(item => <button key={item} onClick={() => setRegion(item)} className={region === item ? "active" : ""}>{item}</button>)}
        </div>
        <div className="layer-list">
          {anatomyLayers.map(layer => <div key={layer.id} className={cn("layer-row", selected === layer.id && "selected")}><button className="layer-main" onClick={() => { setSelected(layer.id); if (!visible[layer.id]) toggleLayer(layer.id); }}><i style={{ background: layer.color }} /><span><strong>{layer.name}</strong><small>{layer.id === "skin" || layer.id === "muscles" || layer.id === "skeleton" ? "Tissue layer" : "Internal structure"}</small></span></button><button className="layer-visibility" onClick={() => toggleLayer(layer.id)} aria-label={`${visible[layer.id] ? "Hide" : "Show"} ${layer.name}`}>{visible[layer.id] ? <Eye size={14} /> : <EyeOff size={14} />}</button></div>)}
        </div>
        <div className="exploded-control"><div><span>Exploded view</span><strong>{exploded}%</strong></div><input aria-label="Exploded view" type="range" min="0" max="100" value={exploded} onChange={e => setExploded(Number(e.target.value))} /></div>
      </aside>

      <section className="anatomy-stage panel">
        <div className="anatomy-stage-top"><div><span className="stage-status"><i /> Interactive 3D</span><b>{region} focus</b></div><div><button className={wireframe ? "active" : ""} onClick={() => setWireframe(!wireframe)}><ScanLine size={14} />Wireframe</button><button className={transparent ? "active" : ""} onClick={() => setTransparent(!transparent)}><Focus size={14} />Transparency</button><button className={labels ? "active" : ""} onClick={() => setLabels(!labels)}><Layers3 size={14} />Labels</button><button onClick={() => setCameraKey(k => k + 1)} aria-label="Reset anatomy view"><RotateCcw size={14} /></button></div></div>
        <div className="anatomy-canvas"><SceneErrorBoundary><Canvas camera={{ position: [0, 0.15, 6.4], fov: 40 }} dpr={[1, 1.6]}><color attach="background" args={["#08131f"]} /><fog attach="fog" args={["#08131f", 7, 13]} /><ambientLight intensity={1.15} /><directionalLight position={[4, 6, 5]} intensity={2.4} color="#d9f8ff" /><directionalLight position={[-4, -2, 3]} intensity={1.2} color="#2979c7" /><Suspense fallback={<Html center><span className="canvas-loader">Loading anatomy…</span></Html>}><Float speed={.65} rotationIntensity={.05} floatIntensity={.08}><ProceduralTorso visible={visible} selected={selected} exploded={exploded} wireframe={wireframe} transparent={transparent} labels={labels} onSelect={setSelected} /></Float><Environment preset="city" environmentIntensity={.35} /></Suspense><OrbitControls key={cameraKey} enablePan={false} minDistance={3.8} maxDistance={9} minPolarAngle={.4} maxPolarAngle={2.7} /></Canvas></SceneErrorBoundary></div>
        <div className="anatomy-stage-bottom"><span>Drag to rotate</span><i /> <span>Scroll to zoom</span><i /> <span>Select structures to inspect</span></div>
      </section>

      <aside className="structure-info panel">
        <div className="structure-color" style={{ background: `linear-gradient(135deg, ${selectedLayer.color}33, transparent)` }}><span style={{ background: selectedLayer.color }} /><BadgeLabel text="Selected structure" /></div>
        <p className="eyebrow">Structure overview</p><h2>{selectedLayer.name}</h2><p>{selectedLayer.description}</p>
        <div className="structure-facts"><div><span>Region</span><strong>{["skin","muscles","skeleton","heart","lungs"].includes(selected) ? "Thorax" : "Abdomen"}</strong></div><div><span>System</span><strong>{selected === "heart" ? "Cardiovascular" : selected === "lungs" ? "Respiratory" : selected === "skeleton" ? "Skeletal" : selected === "muscles" ? "Muscular" : selected === "skin" ? "Integumentary" : "Digestive"}</strong></div></div>
        <div className="training-relevance"><span><Focus size={14} />Training relevance</span><p>{selectedLayer.relevance}</p></div>
        <Button variant="secondary" onClick={() => setSelected(selected === "skin" ? "heart" : "skin")}>Highlight related structure</Button>
        <p className="education-note">Educational visualization only. Not intended for diagnosis or real-patient procedure planning.</p>
      </aside>
    </div>
  );
}

function BadgeLabel({ text }: { text: string }) { return <small>{text}</small>; }

function MaterialProps({ id, selected, wireframe, transparent, color }: { id: AnatomyLayer["id"]; selected: AnatomyLayer["id"]; wireframe: boolean; transparent: boolean; color: string }) {
  const dim = selected !== id;
  return <meshPhysicalMaterial color={color} roughness={.5} metalness={.02} wireframe={wireframe} transparent opacity={dim ? .14 : transparent && id === "skin" ? .28 : .94} transmission={id === "skin" && transparent ? .15 : 0} depthWrite={!transparent || id !== "skin"} emissive={selected === id ? color : "#000000"} emissiveIntensity={selected === id ? .12 : 0} />;
}

function Label({ children, position, show }: { children: string; position: [number, number, number]; show: boolean }) {
  return show ? <Html position={position} center distanceFactor={6.2}><span className="anatomy-label">{children}</span></Html> : null;
}

function ProceduralTorso({ visible, selected, exploded, wireframe, transparent, labels, onSelect }: {
  visible: LayerState; selected: AnatomyLayer["id"]; exploded: number; wireframe: boolean; transparent: boolean; labels: boolean; onSelect: (id: AnatomyLayer["id"]) => void;
}) {
  const spread = exploded / 100;
  const common = { selected, wireframe, transparent };
  const ribs = useMemo(() => Array.from({ length: 7 }, (_, i) => i), []);
  return (
    <group scale={1.12} position={[0, -.1, 0]}>
      {visible.skin && <group onClick={(e) => { e.stopPropagation(); onSelect("skin"); }} position={[0,0,spread*.38]}><mesh scale={[1.28,1.62,.72]}><capsuleGeometry args={[.72,1.45,12,24]} /><MaterialProps id="skin" color="#d6a283" {...common} /></mesh><mesh position={[0,1.72,0]} scale={[.55,.66,.52]}><sphereGeometry args={[1,32,24]} /><MaterialProps id="skin" color="#d6a283" {...common} /></mesh><mesh position={[-1.13,.5,0]} rotation={[0,0,-.12]}><capsuleGeometry args={[.2,1.45,8,16]} /><MaterialProps id="skin" color="#c99275" {...common} /></mesh><mesh position={[1.13,.5,0]} rotation={[0,0,.12]}><capsuleGeometry args={[.2,1.45,8,16]} /><MaterialProps id="skin" color="#c99275" {...common} /></mesh><Label position={[1.35,1.1,.4]} show={labels && selected === "skin"}>Skin layer</Label></group>}
      {visible.muscles && <group onClick={(e) => { e.stopPropagation(); onSelect("muscles"); }} position={[-spread*.95,0,.05]}><mesh scale={[1.05,1.45,.58]}><capsuleGeometry args={[.64,1.3,10,20]} /><MaterialProps id="muscles" color="#a94350" {...common} /></mesh>{[-.55,-.18,.18,.55].map(x => <mesh key={x} position={[x,.35,.56]} scale={[.2,.8,.12]}><capsuleGeometry args={[.16,.65,6,12]} /><MaterialProps id="muscles" color="#c65660" {...common} /></mesh>)}<Label position={[-1.25,.85,.35]} show={labels && selected === "muscles"}>Muscle fibres</Label></group>}
      {visible.skeleton && <group onClick={(e) => { e.stopPropagation(); onSelect("skeleton"); }} position={[spread*1.25,0,.05]}>{ribs.map((i) => <group key={i} position={[0,.85-i*.22,.25]}><mesh position={[-.5,0,0]} rotation={[0,0,Math.PI/2]} scale={[.035,.65-i*.035,.035]}><torusGeometry args={[.62-i*.035,.025,8,30,Math.PI]} /><MaterialProps id="skeleton" color="#e8dfc7" {...common} /></mesh><mesh position={[.5,0,0]} rotation={[0,0,-Math.PI/2]} scale={[.035,.65-i*.035,.035]}><torusGeometry args={[.62-i*.035,.025,8,30,Math.PI]} /><MaterialProps id="skeleton" color="#e8dfc7" {...common} /></mesh></group>)}<mesh position={[0,.1,.36]}><boxGeometry args={[.08,1.65,.08]} /><MaterialProps id="skeleton" color="#f1e8cf" {...common} /></mesh><Label position={[1.05,.75,.35]} show={labels && selected === "skeleton"}>Rib cage</Label></group>}
      {visible.heart && <group onClick={(e) => { e.stopPropagation(); onSelect("heart"); }} position={[spread*.25,.35,spread*1.4]}><mesh position={[.08,.2,.65]} rotation={[0,0,-.28]} scale={[.42,.55,.34]}><sphereGeometry args={[1,24,20]} /><MaterialProps id="heart" color="#d13e53" {...common} /></mesh><mesh position={[-.1,.63,.65]} rotation={[0,0,.05]}><cylinderGeometry args={[.09,.13,.38,16]} /><MaterialProps id="heart" color="#b92d43" {...common} /></mesh><Label position={[.85,.52,.75]} show={labels && selected === "heart"}>Heart</Label></group>}
      {visible.lungs && <group onClick={(e) => { e.stopPropagation(); onSelect("lungs"); }} position={[-spread*.35,.2,spread*1.1]}><mesh position={[-.42,.45,.46]} scale={[.48,.82,.32]} rotation={[0,0,-.08]}><sphereGeometry args={[1,24,20]} /><MaterialProps id="lungs" color="#e8919d" {...common} /></mesh><mesh position={[.42,.45,.46]} scale={[.48,.82,.32]} rotation={[0,0,.08]}><sphereGeometry args={[1,24,20]} /><MaterialProps id="lungs" color="#e8919d" {...common} /></mesh><Label position={[-1.05,.65,.58]} show={labels && selected === "lungs"}>Lungs</Label></group>}
      {visible.liver && <group onClick={(e) => { e.stopPropagation(); onSelect("liver"); }} position={[spread*1.3,-spread*.35,spread*.7]}><mesh position={[-.25,-.62,.38]} scale={[.72,.35,.42]} rotation={[0,0,-.1]}><sphereGeometry args={[1,24,16]} /><MaterialProps id="liver" color="#7f352f" {...common} /></mesh><Label position={[.65,-.55,.5]} show={labels && selected === "liver"}>Liver</Label></group>}
      {visible.stomach && <group onClick={(e) => { e.stopPropagation(); onSelect("stomach"); }} position={[-spread*1.25,-spread*.55,spread*.65]}><mesh position={[.35,-.85,.43]} rotation={[0,0,.4]} scale={[.4,.65,.32]}><sphereGeometry args={[1,24,16]} /><MaterialProps id="stomach" color="#c48674" {...common} /></mesh><Label position={[-.55,-.92,.5]} show={labels && selected === "stomach"}>Stomach</Label></group>}
      <mesh position={[0,-1.45,.72]} rotation={[0,0,.04]}><torusGeometry args={[.52,.018,6,64,Math.PI*.72]} /><meshBasicMaterial color="#4ee2ec" transparent opacity={.75} /></mesh>
    </group>
  );
}
