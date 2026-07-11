"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Html, OrbitControls } from "@react-three/drei";
import { Eye, EyeOff, Focus, Layers3, RotateCcw, ScanLine } from "lucide-react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { anatomyLayers } from "@/data/mockData";
import type { AnatomyLayer } from "@/types";
import { cn } from "@/lib/utils";
import { SceneErrorBoundary } from "./SceneErrorBoundary";
import { SafeMedicalFBX, SafeMedicalGLB } from "@/components/simulation/ModelRegistry";
import { MODEL_PATHS } from "@/data/modelConfig";

type LayerState = Record<AnatomyLayer["id"], boolean>;

const emptyLayers: LayerState = { skin: false, muscles: false, skeleton: false, brain: false, heart: false, lungs: false, kidney: false, liver: false, stomach: false };
const layerRegion: Record<AnatomyLayer["id"], string> = { skin: "Whole body", muscles: "Whole body", skeleton: "Thorax", brain: "Head", heart: "Thorax", lungs: "Thorax", kidney: "Abdomen", liver: "Abdomen", stomach: "Abdomen" };
const regionLayer: Record<string, AnatomyLayer["id"]> = { "Whole body": "skin", Head: "brain", Thorax: "heart", Abdomen: "liver" };
const layerGroups = [
  { label: "Body layers", ids: ["skin", "muscles", "skeleton"] as AnatomyLayer["id"][] },
  { label: "Internal organs", ids: ["brain", "heart", "lungs", "kidney", "liver", "stomach"] as AnatomyLayer["id"][] },
];

const systemFor = (id: AnatomyLayer["id"]) => id === "heart" ? "Cardiovascular" : id === "lungs" ? "Respiratory" : id === "brain" ? "Nervous" : id === "kidney" ? "Urinary" : id === "skeleton" ? "Skeletal" : id === "muscles" ? "Muscular" : id === "skin" ? "Integumentary" : "Digestive";

export function AnatomyViewer() {
  const [visible, setVisible] = useState<LayerState>({ ...emptyLayers, skin: true, heart: true });
  const [selected, setSelected] = useState<AnatomyLayer["id"]>("heart");
  const [exploded, setExploded] = useState(0);
  const [wireframe, setWireframe] = useState(false);
  const [transparent, setTransparent] = useState(true);
  const [labels, setLabels] = useState(true);
  const [region, setRegion] = useState("Thorax");
  const [cameraKey, setCameraKey] = useState(0);
  const selectedLayer = anatomyLayers.find(layer => layer.id === selected)!;
  const toggleLayer = (id: AnatomyLayer["id"]) => setVisible(v => ({ ...v, [id]: !v[id] }));
  const focusLayer = (id: AnatomyLayer["id"]) => {
    setSelected(id);
    setRegion(layerRegion[id]);
    setVisible({ ...emptyLayers, skin: id !== "skin", [id]: true });
  };
  const focusRegion = (nextRegion: string) => focusLayer(regionLayer[nextRegion]);

  return (
    <div className="anatomy-layout">
      {/* ── Left sidebar: layer controls ── */}
      <aside className="anatomy-controls panel">
        <div className="anatomy-panel-head">
          <div>
            <p className="eyebrow">Visibility</p>
            <h2>Anatomy layers</h2>
          </div>
          <Layers3 size={18} />
        </div>

        <div className="body-regions" role="group" aria-label="Body region">
          {["Whole body", "Head", "Thorax", "Abdomen"].map(item => (
            <button
              key={item}
              onClick={() => focusRegion(item)}
              className={region === item ? "active" : ""}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="layer-list">{layerGroups.map(group => <section className="layer-group" key={group.label}><p>{group.label}</p>{group.ids.map(id => { const layer = anatomyLayers.find(item => item.id === id)!; return <div key={layer.id} className={cn("layer-row", selected === layer.id && "selected")}><button className="layer-main" onClick={() => focusLayer(layer.id)}><i style={{ background: layer.color }} /><span><strong>{layer.name}</strong><small>{layerRegion[layer.id]}</small></span></button><button className="layer-visibility" onClick={() => toggleLayer(layer.id)} aria-label={`${visible[layer.id] ? "Hide" : "Show"} ${layer.name}`}>{visible[layer.id] ? <Eye size={15} /> : <EyeOff size={15} />}</button></div>; })}</section>)}</div>

        <div className="exploded-control">
          <div>
            <span>Exploded view</span>
            <strong>{exploded}%</strong>
          </div>
          <input
            aria-label="Exploded view"
            type="range"
            min="0"
            max="100"
            value={exploded}
            onChange={e => setExploded(Number(e.target.value))}
          />
        </div>
      </aside>

      {/* ── Center: 3D canvas stage ── */}
      <section className="anatomy-stage panel">
        <div className="anatomy-stage-top">
          <div>
            <span className="stage-status"><i />Interactive 3D</span>
            <b>{region} focus</b>
          </div>
          <div>
            <button className={wireframe ? "active" : ""} onClick={() => setWireframe(!wireframe)}>
              <ScanLine size={14} />Wireframe
            </button>
            <button className={transparent ? "active" : ""} onClick={() => setTransparent(!transparent)}>
              <Focus size={14} />Transparency
            </button>
            <button className={labels ? "active" : ""} onClick={() => setLabels(!labels)}>
              <Layers3 size={14} />Labels
            </button>
            <button onClick={() => setCameraKey(k => k + 1)} aria-label="Reset anatomy view">
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        <div className="anatomy-canvas">
          <SceneErrorBoundary>
            <Canvas camera={{ position: [0, .45, 3.7], fov: 38 }} dpr={[1, 1.6]}>
              <color attach="background" args={["#eef5f8"]} />
              <fog attach="fog" args={["#eef5f8", 7, 13]} />
              <ambientLight intensity={1.35} />
              <directionalLight position={[4, 6, 5]} intensity={2.3} color="#ffffff" />
              <directionalLight position={[-4, 1, 3]} intensity={.65} color="#8fbfe0" />
              <Suspense fallback={<Html center><span className="canvas-loader">Loading anatomy…</span></Html>}>
                <ProceduralTorso visible={visible} selected={selected} exploded={exploded} wireframe={wireframe} transparent={transparent} labels={labels} onSelect={focusLayer} />
                <Environment preset="city" environmentIntensity={.35} />
              </Suspense>
              <ContactShadows position={[0,-2.15,0]} opacity={.18} scale={6} blur={2.4} far={5} />
              <AnatomyCamera region={region} revision={cameraKey} />
            </Canvas>
          </SceneErrorBoundary>
        </div>

        <div className="anatomy-stage-bottom">
          <span>Drag to rotate</span>
          <i />
          <span>Scroll to zoom</span>
          <i />
          <span>Select structures to inspect</span>
        </div>
      </section>

      {/* ── Right sidebar: structure details ── */}
      <aside className="structure-info panel">
        <div className="structure-heading"><span style={{ background: selectedLayer.color }} /><div><p className="eyebrow">Selected structure</p><h2>{selectedLayer.name}</h2></div><button onClick={() => toggleLayer(selected)} aria-label={`${visible[selected] ? "Hide" : "Show"} ${selectedLayer.name}`}>{visible[selected] ? <Eye size={16} /> : <EyeOff size={16} />}</button></div>
        <div className="structure-facts"><div><span>Region</span><strong>{layerRegion[selected]}</strong></div><div><span>System</span><strong>{systemFor(selected)}</strong></div></div>
        <section className="structure-copy"><span>What you&apos;re seeing</span><p>{selectedLayer.description}</p></section>
        <div className="training-relevance"><span><Focus size={14} />Procedure relevance</span><p>{selectedLayer.relevance}</p></div>
        <button className="focus-structure" onClick={() => setCameraKey(key => key + 1)}><Focus size={14} />Refocus selected region</button>
        <p className="education-note">Educational visualization only. Not intended for diagnosis or real-patient procedure planning.</p>
      </aside>
    </div>
  );
}

function AnatomyCamera({ region, revision }: { region: string; revision: number }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  useEffect(() => {
    const preset = region === "Head" ? { position: [0, 1.65, 3.1], target: [0, 1.55, 0] } : region === "Abdomen" ? { position: [0, -.45, 3.25], target: [0, -.48, .1] } : region === "Whole body" ? { position: [0, .05, 6.2], target: [0, 0, 0] } : { position: [0, .45, 3.55], target: [0, .45, .1] };
    camera.position.set(...preset.position);
    controls.current?.target.set(...preset.target);
    controls.current?.update();
  }, [camera, region, revision]);
  return <OrbitControls ref={controls} enablePan={false} minDistance={2.4} maxDistance={7} minPolarAngle={.5} maxPolarAngle={2.55} />;
}

function MaterialProps({ id, selected, wireframe, transparent, color }: { id: AnatomyLayer["id"]; selected: AnatomyLayer["id"]; wireframe: boolean; transparent: boolean; color: string }) {
  const dim = selected !== id;
  return <meshPhysicalMaterial color={color} roughness={.5} metalness={.02} wireframe={wireframe} transparent opacity={dim ? .14 : transparent && id === "skin" ? .28 : .94} transmission={id === "skin" && transparent ? .15 : 0} depthWrite={!transparent || id !== "skin"} emissive={selected === id ? color : "#000000"} emissiveIntensity={selected === id ? .12 : 0} />;
}

function Label({ children, position, show }: { children: string; position: [number, number, number]; show: boolean }) {
  return show ? <Html position={position} center distanceFactor={6.2}><span className="anatomy-label">{children}</span></Html> : null;
}

function AssetOpacity({ id, selected, transparent }: { id: AnatomyLayer["id"]; selected: AnatomyLayer["id"]; transparent: boolean }) {
  return selected === id ? .98 : transparent ? .2 : .78;
}

function FallbackRibCage({ common }: { common: { selected: AnatomyLayer["id"]; wireframe: boolean; transparent: boolean } }) {
  const ribs = useMemo(() => Array.from({ length: 7 }, (_, i) => i), []);
  return <group>{ribs.map(i => <group key={i} position={[0,.85-i*.22,.25]}><mesh position={[-.5,0,0]} rotation={[0,0,Math.PI/2]} scale={[.035,.65-i*.035,.035]}><torusGeometry args={[.62-i*.035,.025,8,30,Math.PI]} /><MaterialProps id="skeleton" color="#e8dfc7" {...common} /></mesh><mesh position={[.5,0,0]} rotation={[0,0,-Math.PI/2]} scale={[.035,.65-i*.035,.035]}><torusGeometry args={[.62-i*.035,.025,8,30,Math.PI]} /><MaterialProps id="skeleton" color="#e8dfc7" {...common} /></mesh></group>)}</group>;
}
function FallbackHeart({ common }: { common: { selected: AnatomyLayer["id"]; wireframe: boolean; transparent: boolean } }) { return <mesh scale={[.42,.55,.34]}><sphereGeometry args={[1,24,20]} /><MaterialProps id="heart" color="#d13e53" {...common} /></mesh>; }
function FallbackLungs({ common }: { common: { selected: AnatomyLayer["id"]; wireframe: boolean; transparent: boolean } }) { return <group><mesh position={[-.36,0,0]} scale={[.48,.82,.32]}><sphereGeometry args={[1,24,20]} /><MaterialProps id="lungs" color="#e8919d" {...common} /></mesh><mesh position={[.36,0,0]} scale={[.48,.82,.32]}><sphereGeometry args={[1,24,20]} /><MaterialProps id="lungs" color="#e8919d" {...common} /></mesh></group>; }
function FallbackSkinLayer({ common }: { common: { selected: AnatomyLayer["id"]; wireframe: boolean; transparent: boolean } }) { return <group><mesh scale={[1.28,1.62,.72]}><capsuleGeometry args={[.72,1.45,12,24]} /><MaterialProps id="skin" color="#d6a283" {...common} /></mesh><mesh position={[0,1.72,0]} scale={[.55,.66,.52]}><sphereGeometry args={[1,32,24]} /><MaterialProps id="skin" color="#d6a283" {...common} /></mesh><mesh position={[-1.13,.5,0]} rotation={[0,0,-.12]}><capsuleGeometry args={[.2,1.45,8,16]} /><MaterialProps id="skin" color="#c99275" {...common} /></mesh><mesh position={[1.13,.5,0]} rotation={[0,0,.12]}><capsuleGeometry args={[.2,1.45,8,16]} /><MaterialProps id="skin" color="#c99275" {...common} /></mesh></group>; }

function ProceduralTorso({ visible, selected, exploded, wireframe, transparent, labels, onSelect }: {
  visible: LayerState; selected: AnatomyLayer["id"]; exploded: number; wireframe: boolean; transparent: boolean; labels: boolean; onSelect: (id: AnatomyLayer["id"]) => void;
}) {
  const spread = exploded / 100;
  const common = { selected, wireframe, transparent };
  return (
    <group scale={1.12} position={[0, -.1, 0]}>
      {visible.skin && <group onClick={(e) => { e.stopPropagation(); onSelect("skin"); }} position={[0,-.05,spread*.38]}><SafeMedicalFBX path={MODEL_PATHS.alternatePatient} targetSize={4.35} preserveTextures={false} color="#d1a086" roughness={.78} opacity={transparent ? (selected === "skin" ? .72 : .1) : (selected === "skin" ? .9 : .3)} wireframe={wireframe} fallback={<FallbackSkinLayer common={common} />} /><Label position={[1.35,1.1,.4]} show={labels && selected === "skin"}>Skin layer</Label></group>}
      {visible.muscles && <group onClick={(e) => { e.stopPropagation(); onSelect("muscles"); }} position={[-spread*.95,0,.05]}><SafeMedicalGLB path={MODEL_PATHS.muscle} targetSize={3.65} color="#b64953" metalness={0} roughness={.72} preserveTextures={false} opacity={AssetOpacity({id:"muscles",selected,transparent})} wireframe={wireframe} fallback={<group><mesh scale={[.76,1.22,.46]}><capsuleGeometry args={[.64,1.3,10,20]} /><MaterialProps id="muscles" color="#a94350" {...common} /></mesh>{[-.42,-.14,.14,.42].map(x => <mesh key={x} position={[x,.35,.48]} scale={[.15,.68,.1]}><capsuleGeometry args={[.16,.65,6,12]} /><MaterialProps id="muscles" color="#c65660" {...common} /></mesh>)}</group>} /><Label position={[-1.05,.75,.35]} show={labels && selected === "muscles"}>Muscle layer</Label></group>}
      {
  visible.skeleton && (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onSelect("skeleton");
      }}
      position={[spread * 1.25, 0.66, 0.08]}
      rotation={[0, Math.PI * 1.5, 0]} // 270°
      scale={0.75}
    >
      <group rotation={[0, 0, Math.PI / 2]}>
        <SafeMedicalGLB
          path={MODEL_PATHS.ribCage}
          targetSize={1.55}
          color="#e9e1ca"
          metalness={0.02}
          roughness={0.64}
          preserveTextures={false}
          opacity={AssetOpacity({
            id: "skeleton",
            selected,
            transparent,
          })}
          rotation={[0, Math.PI / 2, 0]}
          fallback={
            <group rotation={[0, 0, -Math.PI / 2]}>
              <FallbackRibCage common={common} />
            </group>
          }
        />
      </group>

      <Label
        position={[-0.78, 0.55, 0.25]}
        show={labels && selected === "skeleton"}
      >
        Rib cage
      </Label>
    </group>
  )
}
      {visible.brain && <group onClick={(e) => { e.stopPropagation(); onSelect("brain"); }} position={[-spread*.75,1.72,spread*.8]}><group rotation={[0,0,Math.PI/2]}><SafeMedicalGLB path={MODEL_PATHS.brain} targetSize={.5} color="#d9a6a6" metalness={0} roughness={.76} preserveTextures={false} opacity={AssetOpacity({id:"brain",selected,transparent})} rotation={[0,Math.PI/2,0]} fallback={<mesh scale={[.3,.24,.28]}><sphereGeometry args={[1,24,18]} /><MaterialProps id="brain" color="#d9a6a6" {...common} /></mesh>} /></group><Label position={[.48,.14,.25]} show={labels && selected === "brain"}>Brain</Label></group>}
      {visible.heart && <group onClick={(e) => { e.stopPropagation(); onSelect("heart"); }} position={[.11+spread*.25,.84,spread*1.4+.3]} rotation={[0,0,-.08]}><SafeMedicalGLB path={MODEL_PATHS.heart} targetSize={.48} preserveTextures opacity={AssetOpacity({id:"heart",selected,transparent})} fallback={<FallbackHeart common={common} />} /><Label position={[.46,.12,.2]} show={labels && selected === "heart"}>Heart</Label></group>}
      {visible.lungs && <group onClick={(e) => { e.stopPropagation(); onSelect("lungs"); }} position={[-spread*.35,.79,spread*1.1+.22]}><SafeMedicalGLB path={MODEL_PATHS.lungs} targetSize={1.02} color="#e58f9b" metalness={0} roughness={.72} preserveTextures={false} opacity={AssetOpacity({id:"lungs",selected,transparent})} fallback={<FallbackLungs common={common} />} /><Label position={[-.7,.2,.2]} show={labels && selected === "lungs"}>Lungs</Label></group>}
      {visible.kidney && <group onClick={(e) => { e.stopPropagation(); onSelect("kidney"); }} position={[spread*.8,.38,spread*.95+.16]}><SafeMedicalGLB path={MODEL_PATHS.kidney} targetSize={.62} color="#984d46" metalness={0} roughness={.7} preserveTextures={false} opacity={AssetOpacity({id:"kidney",selected,transparent})} fallback={<group><mesh position={[-.25,0,0]} scale={[.2,.3,.15]}><sphereGeometry args={[1,20,16]} /><MaterialProps id="kidney" color="#984d46" {...common} /></mesh><mesh position={[.25,0,0]} scale={[.2,.3,.15]}><sphereGeometry args={[1,20,16]} /><MaterialProps id="kidney" color="#984d46" {...common} /></mesh></group>} /><Label position={[.58,.08,.2]} show={labels && selected === "kidney"}>Kidneys</Label></group>}
      {visible.liver && <group onClick={(e) => { e.stopPropagation(); onSelect("liver"); }} position={[spread*1.3,-spread*.35,spread*.7]}><SafeMedicalGLB path={MODEL_PATHS.liver} targetSize={.7} color="#7f352f" metalness={0} roughness={.7} preserveTextures={false} opacity={AssetOpacity({id:"liver",selected,transparent})} position={[-.26,.56,.26]} rotation={[0,0,-.1]} fallback={<mesh position={[-.26,.56,.26]} scale={[.48,.22,.28]} rotation={[0,0,-.1]}><sphereGeometry args={[1,24,16]} /><MaterialProps id="liver" color="#7f352f" {...common} /></mesh>} /><Label position={[.43,.54,.38]} show={labels && selected === "liver"}>Liver</Label></group>}
      {visible.stomach && <group onClick={(e) => { e.stopPropagation(); onSelect("stomach"); }} position={[-spread*1.25,-spread*.55,spread*.65]}><SafeMedicalGLB path={MODEL_PATHS.stomach} targetSize={.54} color="#c48674" metalness={0} roughness={.72} preserveTextures={false} opacity={AssetOpacity({id:"stomach",selected,transparent})} position={[.22,.46,.27]} rotation={[0,0,.28]} fallback={<mesh position={[.22,.46,.27]} rotation={[0,0,.4]} scale={[.24,.35,.19]}><sphereGeometry args={[1,24,16]} /><MaterialProps id="stomach" color="#c48674" {...common} /></mesh>} /><Label position={[-.38,.42,.38]} show={labels && selected === "stomach"}>Stomach</Label></group>}
    </group>
  );
}
