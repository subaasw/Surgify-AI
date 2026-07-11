"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Html, Lightformer, Line, OrbitControls, RoundedBox, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { SceneErrorBoundary } from "@/components/anatomy/SceneErrorBoundary";
import { useSimulation } from "./SimulationProvider";
import type { CameraMode } from "@/types/simulation";
import { MedicalGLB, ModelErrorBoundary, SafeMedicalGLB } from "./ModelRegistry";
import { GestureHand, HandTrackingDriver, handWorld, collisionMeshes } from "./GestureHandControl";
import { SurgicalPhysics, TOOL_ASSETS, surgerySite } from "./HandPhysics";
import { MODEL_PATHS } from "@/data/modelConfig";
import { WoundSurface } from "./WoundSurface";
import { damp, guidedCameraMode } from "@/lib/handPhysics.mjs";

const presets: Record<Exclude<CameraMode, "webcam"> | "pov", { position: [number, number, number]; target: [number, number, number] }> = {
  // first-person surgeon view: hands enter from the bottom edge like VR
  pov: { position: [0, 3.5, 4.3], target: [0, 1.35, -1] },
  room: { position: [3.45, 4.7, 5.9], target: [0, 1.15, 0] },
  patient: { position: [3.35, 3.4, 4.7], target: [0, 1.7, 0] },
  closeup: { position: [-1.3, 2.5, 0.8], target: [-.62, 1.98, .18] },
  anatomy: { position: [3.35, 2.8, 4.2], target: [0, 1.72, .1] },
  tray: { position: [3.6, 2.9, .65], target: [2.82, 1.15, -.62] },
};
const cameraBounds = { min: new THREE.Vector3(-3.55, .45, -5.95), max: new THREE.Vector3(3.55, 5.1, 6.35) };

// hand-driven POV dolly: reach into the field pulls the camera from a wide
// establishing shot toward a close-up centred on where the hands are working.
const POV_WIDE = 5.7; // dolly distance (world units) when hands are pulled back
const POV_NEAR = 2.5; // dolly distance when reaching deep over the patient
const povDir = new THREE.Vector3();
const povPinch = new THREE.Vector3();
const povWantCenter = new THREE.Vector3();

export function HospitalScene() {
  const { state, selectRegion } = useSimulation();
  const patientProps = { selected: state.selectedRegion, anatomy: state.anatomyOverlay, stitchPhase: state.stitchPhase, selectedTool: state.selectedTool, onSelect: selectRegion };
  const proceduralPatient = <FallbackPatient {...patientProps} />;
  const legacyPatient = <ModelErrorBoundary fallback={proceduralPatient}><Suspense fallback={proceduralPatient}><LoadedLegacyPatient {...patientProps} /></Suspense></ModelErrorBoundary>;
  const heldTools = Object.values(state.heldTools).filter((tool): tool is string => Boolean(tool));
  const cameraMode = guidedCameraMode(state.currentStep, state.stitchPhase, heldTools, state.trackingOverlay, state.cameraMode) as Exclude<CameraMode, "webcam"> | "pov";
  const guided = state.trackingOverlay && state.movementMode === "surgical" && state.currentStep >= 4;
  return <SceneErrorBoundary>{state.trackingOverlay && <HandTrackingDriver />}<Canvas className="hospital-scene-canvas" shadows dpr={1} camera={{ position: presets.room.position, fov: 44, near: .1, far: 40 }} gl={{ antialias: true }}><color attach="background" args={["#02070b"]} /><fog attach="fog" args={["#091119", 12, 23]} /><ambientLight intensity={.72} /><hemisphereLight args={["#eaf5f7", "#26333a", 1.25]} /><directionalLight castShadow position={[4, 8, 5]} intensity={2.2} color="#f7fbfa" shadow-mapSize={[512, 512]} /><pointLight position={[-4, 3.5, 1]} intensity={1.2} color="#b8dcf2" /><Environment resolution={32}><Lightformer form="rect" intensity={1.2} color="#e9fbff" scale={[8, 3, 1]} position={[0, 6, -1]} rotation={[Math.PI / 2, 0, 0]} /></Environment><CameraRig mode={cameraMode} locked={guided} /><SafeMedicalGLB path={MODEL_PATHS.operationTheatre} targetSize={14} preserveMaterials castShadows={false} position={[0,1.66,0]} rotation={[0,Math.PI/2,0]} fallback={<HospitalRoom />} /><SafeMedicalGLB path={MODEL_PATHS.hospitalBed} targetSize={5.35} preserveMaterials position={[0,1.12,0]} fallback={<FallbackHospitalBed />} /><ModelErrorBoundary fallback={legacyPatient}><Suspense fallback={proceduralPatient}><LoadedPatient {...patientProps} /></Suspense></ModelErrorBoundary><FallbackMonitor /><IVStand /><InstrumentTray selectedTool={state.selectedTool} physical={state.trackingOverlay} />{state.trackingOverlay && state.movementMode === "surgical" && <GestureHand mode={cameraMode} />}<SurgicalPhysics active={state.trackingOverlay && state.movementMode === "surgical"} /><ContactShadows frames={1} resolution={192} position={[0, .02, 0]} opacity={.32} scale={15} blur={2.6} far={5} /></Canvas></SceneErrorBoundary>;
}

function CameraRig({ mode, locked }: { mode: Exclude<CameraMode, "webcam"> | "pov"; locked: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const transitioning = useRef(true);
  const povDist = useRef(POV_WIDE);
  const povReach = useRef(0);
  const povCenter = useRef(new THREE.Vector3(...presets.pov.target));
  const { camera } = useThree();
  useEffect(() => { transitioning.current = true; }, [mode]);
  useFrame((_, delta) => {
    const control = controls.current;
    if (!control) return;
    if (transitioning.current) {
      const preset = presets[mode];
      const position = new THREE.Vector3(...preset.position);
      const target = new THREE.Vector3(...preset.target);
      const rate = 1 - Math.pow(.0008, delta);
      camera.position.lerp(position, rate);
      control.target.lerp(target, rate);
      if (camera.position.distanceTo(position) < .035 && control.target.distanceTo(target) < .035) transitioning.current = false;
    }
    // POV zoom: once settled and hands are tracked, dolly by average reach and
    // recentre on the hands; idle (no hands) leaves the user's mouse in charge
    if (mode === "pov" && !transitioning.current) {
      const live = [handWorld.Right, handWorld.Left].filter(h => h.live);
      if (live.length) {
        let reach = 0;
        povPinch.set(0, 0, 0);
        for (const h of live) { reach += h.reach; povPinch.add(h.pinchPoint); }
        reach /= live.length;
        povPinch.divideScalar(live.length);
        // Smooth the noisy reach + pinch centre ONCE, then place the target and
        // camera directly from them. The old code eased povCenter→target→camera
        // in a cascade, so each stage lagged the previous one and the view
        // rubber-banded behind the hands. Single-stage easing = smooth, no lag.
        povReach.current = THREE.MathUtils.lerp(povReach.current, reach, damp(6, delta));
        const lean = THREE.MathUtils.smoothstep(povReach.current, .1, .95);
        povWantCenter.set(...presets.pov.target).lerp(povPinch, lean * .6);
        povCenter.current.lerp(povWantCenter, damp(7, delta));
        povDist.current = THREE.MathUtils.lerp(povDist.current, THREE.MathUtils.lerp(POV_WIDE, POV_NEAR, lean), damp(3.5, delta));
        povDir.copy(camera.position).sub(control.target); // keep the fixed POV viewing angle
        if (povDir.lengthSq() < 1e-6) povDir.set(0, .5, 1);
        povDir.normalize();
        control.target.copy(povCenter.current);
        camera.position.copy(control.target).addScaledVector(povDir, povDist.current);
      } else { // hold state so re-entry from mouse control is seamless
        povDist.current = camera.position.distanceTo(control.target);
        povCenter.current.copy(control.target);
        povReach.current = 0;
      }
    }
    control.target.x = THREE.MathUtils.clamp(control.target.x, -3.2, 3.2);
    control.target.y = THREE.MathUtils.clamp(control.target.y, .55, 3.1);
    control.target.z = THREE.MathUtils.clamp(control.target.z, -3.4, 3.4);
    control.update();
    camera.position.clamp(cameraBounds.min, cameraBounds.max);
  });
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.08} enableRotate={!locked} enablePan={!locked} enableZoom={!locked} minDistance={mode === "closeup" ? .72 : mode === "tray" ? 1.4 : 2.15} maxDistance={7.8} minPolarAngle={.28} maxPolarAngle={1.47} minAzimuthAngle={-1.8} maxAzimuthAngle={1.8} target={presets.room.target} />;
}

function HospitalRoom() {
  const floorLines = useMemo(() => Array.from({ length: 13 }, (_, i) => -6 + i), []);
  return <group>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}><planeGeometry args={[14, 12]} /><meshStandardMaterial color="#9ca5a8" roughness={.88} /></mesh>
    {floorLines.map(value => <group key={value}><Line points={[[value,.006,-6],[value,.006,6]]} color="#899295" lineWidth={.45} /><Line points={[[-7,.006,value],[7,.006,value]]} color="#899295" lineWidth={.45} /></group>)}
    <mesh receiveShadow position={[0, 3.2, -5.2]}><boxGeometry args={[14, 6.4, .18]} /><meshStandardMaterial color="#d8ddde" roughness={.95} /></mesh>
    <mesh receiveShadow position={[-6.8, 3.2, 0]}><boxGeometry args={[.18, 6.4, 10.5]} /><meshStandardMaterial color="#cfd5d6" roughness={.95} /></mesh>
    <mesh position={[0, 2.6, -5.08]}><boxGeometry args={[11.5, .85, .05]} /><meshStandardMaterial color="#bcc9cc" /></mesh>
    <mesh position={[0, 2.62, -5.02]}><boxGeometry args={[8.4, .52, .04]} /><meshStandardMaterial color="#e8ebea" /></mesh>
    {[-3.5,-2.6,-1.7].map(x => <group key={x} position={[x,2.62,-4.97]}><mesh><circleGeometry args={[.13,20]} /><meshStandardMaterial color="#809499" /></mesh><mesh position={[.23,0,0]}><boxGeometry args={[.18,.18,.04]} /><meshStandardMaterial color="#8da0a4" /></mesh></group>)}
    <group position={[4.65,1.75,-5]}><mesh><boxGeometry args={[1.2,2.45,.12]} /><meshStandardMaterial color="#c6ced0" /></mesh><mesh position={[0,.5,.08]}><boxGeometry args={[.72,.92,.05]} /><meshStandardMaterial color="#9db6bd" /></mesh><mesh position={[0,-.55,.08]}><boxGeometry args={[.72,.58,.05]} /><meshStandardMaterial color="#e3e7e7" /></mesh></group>
    <group position={[-5.95,1.2,-3.4]}><mesh><boxGeometry args={[.35,1.8,.55]} /><meshStandardMaterial color="#b74f4d" /></mesh><mesh position={[0,.55,.3]}><circleGeometry args={[.11,20]} /><meshStandardMaterial color="#e0d9d3" /></mesh></group>
    <mesh position={[0,6.15,0]} rotation={[Math.PI/2,0,0]}><planeGeometry args={[14,11]} /><meshStandardMaterial color="#edf0ef" /></mesh>
  </group>;
}

export function FallbackHospitalBed() {
  return <group position={[0,0,0]}>
    <RoundedBox castShadow receiveShadow args={[2.55,.28,5.35]} radius={.12} position={[0,.72,0]}><meshStandardMaterial color="#788389" metalness={.38} roughness={.4} /></RoundedBox>
    <RoundedBox castShadow receiveShadow args={[2.35,.36,4.95]} radius={.16} position={[0,1.02,0]}><meshStandardMaterial color="#e5eceb" roughness={.92} /></RoundedBox>
    <RoundedBox args={[2.48,1.15,.13]} radius={.08} position={[0,1.35,-2.55]}><meshStandardMaterial color="#9aa8ad" metalness={.25} /></RoundedBox>
    <RoundedBox args={[2.48,.76,.12]} radius={.07} position={[0,1.1,2.55]}><meshStandardMaterial color="#9aa8ad" metalness={.25} /></RoundedBox>
    {[-1.25,1.25].map(x => <group key={x}>{[-1.8,1.8].map(z => <group key={z} position={[x,.35,z]}><mesh><cylinderGeometry args={[.06,.06,.65,12]} /><meshStandardMaterial color="#596368" metalness={.5} /></mesh><mesh rotation={[Math.PI/2,0,0]} position={[0,-.35,0]}><torusGeometry args={[.12,.04,8,16]} /><meshStandardMaterial color="#3d464a" /></mesh></group>)}</group>)}
    {[-1.35,1.35].map(x => <group key={x} position={[x,1.45,0]}><mesh><boxGeometry args={[.05,.38,4.15]} /><meshStandardMaterial color="#aab5b8" metalness={.45} /></mesh>{[-1.7,-.85,0,.85,1.7].map(z => <mesh key={z} position={[0,-.16,z]}><boxGeometry args={[.04,.3,.04]} /><meshStandardMaterial color="#8d999d" /></mesh>)}</group>)}
    <RoundedBox args={[1.55,.22,.75]} radius={.18} position={[0,1.33,-1.88]} rotation={[-.08,0,0]}><meshStandardMaterial color="#f5f7f5" roughness={1} /></RoundedBox>
  </group>;
}

type PatientProps = { selected: string | null; anatomy: boolean; stitchPhase: number; selectedTool: string | null; onSelect: (region: string) => void };

// All five Man assets share this HumanBody.glb coordinate system. Keeping one
// transform is what makes the independently exported layers line up exactly.
const MAN_CENTER = new THREE.Vector3(0, .87148, -.00135);
const MAN_SCALE = 3.85 / 1.74372;
type ManLayerKind = "skin" | "muscle" | "bone" | "vascular" | "nerve";

function ManLayer({ path, kind, color, opacity = 1, preservePalette = false }: { path: string; kind: ManLayerKind; color: string; opacity?: number; preservePalette?: boolean }) {
  const { scene } = useGLTF(path);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = kind === "skin";
      object.receiveShadow = kind === "skin";
      object.renderOrder = kind === "skin" ? 4 : kind === "muscle" ? 3 : 2;
      const paint = (source: THREE.Material) => {
        const authored = source.clone() as THREE.MeshStandardMaterial;
        const hasMap = "map" in authored && Boolean(authored.map);
        if (preservePalette && hasMap) {
          authored.transparent = opacity < 1;
          authored.opacity = opacity;
          authored.depthWrite = opacity >= 1;
          if ("roughness" in authored) authored.roughness = Math.max(authored.roughness ?? 0, .58);
          return authored;
        }
        const name = source.name.toLowerCase();
        const materialColor = kind === "skin" && name.includes("black") ? "#26282b"
          : kind === "skin" && name.includes("nail") ? "#dfb9ad"
          : color;
        return new THREE.MeshStandardMaterial({
          color: materialColor,
          roughness: kind === "bone" ? .7 : .78,
          metalness: 0,
          vertexColors: Boolean(object.geometry.getAttribute("color")),
          transparent: opacity < 1,
          opacity,
          depthWrite: opacity >= 1,
        });
      };
      const materials = (Array.isArray(object.material) ? object.material : [object.material]).map(paint);
      object.material = Array.isArray(object.material) ? materials : materials[0];
    });
    clone.scale.setScalar(MAN_SCALE);
    clone.position.copy(MAN_CENTER).multiplyScalar(-MAN_SCALE);
    return clone;
  }, [scene, kind, color, opacity, preservePalette]);
  return <primitive object={model} />;
}

function InternalPatientLayers() {
  return <ModelErrorBoundary fallback={<group />}><Suspense fallback={null}>
    <ManLayer path={MODEL_PATHS.patientMuscular} kind="muscle" color="#b9474f" opacity={.42} preservePalette />
    <ManLayer path={MODEL_PATHS.patientSkeletal} kind="bone" color="#e8dfc7" opacity={.82} preservePalette />
    <ManLayer path={MODEL_PATHS.patientCardiovascular} kind="vascular" color="#b73543" opacity={.9} preservePalette />
    <ManLayer path={MODEL_PATHS.patientNervous} kind="nerve" color="#e6c75b" opacity={.9} preservePalette />
  </Suspense></ModelErrorBoundary>;
}

function SurgicalDrape({ anatomy }: { anatomy: boolean }) {
  return <group position={[0, .29, .57]}>
    <RoundedBox args={[1.12, .035, 1.08]} radius={.07} castShadow receiveShadow>
      <meshStandardMaterial color="#27806f" roughness={.96} transparent={anatomy} opacity={anatomy ? .4 : 1} />
    </RoundedBox>
    {[-.28, 0, .28].map((z) => <mesh key={z} position={[0, .022, z]} receiveShadow>
      <boxGeometry args={[.9, .008, .018]} />
      <meshStandardMaterial color="#1f685d" roughness={1} transparent={anatomy} opacity={anatomy ? .3 : .55} />
    </mesh>)}
  </group>;
}

function LoadedPatient({ selected, anatomy, stitchPhase, selectedTool, onSelect }: PatientProps) {
  const breathing = useRef<THREE.Group>(null);
  // register the body mesh so hands raycast against it and rest on its surface
  useEffect(() => {
    const body = breathing.current;
    if (!body) return;
    collisionMeshes.push(body);
    return () => { const i = collisionMeshes.indexOf(body); if (i >= 0) collisionMeshes.splice(i, 1); };
  }, []);
  useFrame(({ clock }) => {
    if (breathing.current) breathing.current.position.y = 1.74 + Math.sin(clock.elapsedTime * 1.35) * .008;
  });
  return <group>
    <group ref={breathing} position={[0, 1.74, -.05]}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <ManLayer path={MODEL_PATHS.patient} kind="skin" color="#c99078" opacity={anatomy ? .16 : 1} />
        {anatomy && <InternalPatientLayers />}
      </group>
      <SurgicalDrape anatomy={anatomy} />
      {selected === "Right arm" && <WoundTrainingPatch anatomy={anatomy} position={[-.62, .19, .15]} />}
    </group>
    <PatientInteractionZones selected={selected} anatomy={anatomy} stitchPhase={stitchPhase} selectedTool={selectedTool} onSelect={onSelect} />
  </group>;
}

function LoadedLegacyPatient({ selected, anatomy, stitchPhase, selectedTool, onSelect }: PatientProps) {
  return <group>
    <group position={[0,1.46,-.05]}><MedicalGLB path={MODEL_PATHS.legacyPatient} targetSize={4.35} preserveTextures opacity={anatomy ? .38 : 1} /></group>
    {selected === "Right arm" && <WoundTrainingPatch anatomy={anatomy} position={[-.62, 1.93, .1]} />}
    <PatientInteractionZones selected={selected} anatomy={anatomy} stitchPhase={stitchPhase} selectedTool={selectedTool} onSelect={onSelect} />
  </group>;
}

function PatientInteractionZones({ selected, anatomy, onSelect }: PatientProps) {
  return <group position={[0, 1.72, -.08]}>
    <group position={[0,.18,-1.65]}><Region region="Head" selected={selected} onSelect={onSelect}><mesh scale={[.48,.4,.55]}><sphereGeometry args={[1,16,12]} /><HitMaterial /></mesh></Region></group>
    <group position={[0,.1,-.62]}><Region region="Chest" selected={selected} onSelect={onSelect}><mesh rotation={[Math.PI/2,0,0]} scale={[.9,.56,1]}><capsuleGeometry args={[.48,1.05,8,14]} /><HitMaterial /></mesh></Region>{anatomy&&<TorsoAnatomy />}</group>
    <group position={[0,.08,.08]}><Region region="Abdomen" selected={selected} onSelect={onSelect}><mesh rotation={[Math.PI/2,0,0]} scale={[.8,.5,.82]}><capsuleGeometry args={[.45,.72,8,14]} /><HitMaterial /></mesh></Region></group>
    <PatientArmZone label="Left arm" x={.62} selected={selected} onSelect={onSelect} />
    <PatientArmZone label="Right arm" x={-.62} selected={selected} onSelect={onSelect} />
    <PatientLegZone label="Left leg" x={.24} selected={selected} onSelect={onSelect} />
    <PatientLegZone label="Right leg" x={-.24} selected={selected} onSelect={onSelect} />
  </group>;
}

function HitMaterial() { return <meshBasicMaterial transparent opacity={.001} depthWrite={false} />; }
function PatientArmZone({ label, x, selected, onSelect, wound = false, anatomy = false }: { label:string;x:number;selected:string|null;onSelect:(r:string)=>void;wound?:boolean;anatomy?:boolean }) {
  return <group position={[x,.07,-.15]}><Region region={label} selected={selected} onSelect={onSelect}><mesh rotation={[Math.PI/2,0,0]} position={[0,0,.05]}><capsuleGeometry args={[.2,1.45,8,14]} /><HitMaterial /></mesh>{wound && selected===label && <WoundTrainingPatch anatomy={anatomy} />}</Region></group>;
}
function PatientLegZone({ label, x, selected, onSelect }: { label:string;x:number;selected:string|null;onSelect:(r:string)=>void }) {
  return <group position={[x,-.04,1.65]}><Region region={label} selected={selected} onSelect={onSelect}><mesh rotation={[Math.PI/2,0,0]}><capsuleGeometry args={[.27,1.75,8,14]} /><HitMaterial /></mesh></Region></group>;
}

export function FallbackPatient({ selected, anatomy, onSelect }: PatientProps) {
  const chest = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (chest.current) chest.current.scale.y = 1 + Math.sin(clock.elapsedTime * 1.4) * .012; });
  return <group position={[0,1.38,-.08]}>
    <group position={[0,.18,-1.65]}><Region region="Head" selected={selected} onSelect={onSelect}><mesh castShadow scale={[.42,.34,.48]}><sphereGeometry args={[1,28,20]} /><SkinMaterial selected={selected === "Head"} anatomy={anatomy} /></mesh><mesh position={[-.15,.12,.42]} scale={[.036,.025,.02]}><sphereGeometry /><meshBasicMaterial color="#333c40" /></mesh><mesh position={[.15,.12,.42]} scale={[.036,.025,.02]}><sphereGeometry /><meshBasicMaterial color="#333c40" /></mesh><mesh position={[0,-.05,.47]} scale={[.05,.025,.018]}><sphereGeometry /><meshStandardMaterial color="#a76f62" /></mesh></Region></group>
    <group ref={chest} position={[0,.1,-.62]}><Region region="Chest" selected={selected} onSelect={onSelect}><mesh castShadow rotation={[Math.PI/2,0,0]} scale={[.84,.5,1]}><capsuleGeometry args={[.48,1.05,10,20]} /><meshStandardMaterial color="#668ca4" roughness={.82} emissive={selected === "Chest" ? "#2c8d9a" : "#000"} emissiveIntensity={.28} transparent={anatomy} opacity={anatomy ? .42 : 1} /></mesh><mesh position={[0,.23,-.05]} rotation={[-Math.PI/2,0,0]}><boxGeometry args={[1.28,.72,.03]} /><meshStandardMaterial color="#81a6b9" roughness={.8} /></mesh></Region>{anatomy&&<TorsoAnatomy />}</group>
    <group position={[0,.08,.08]}><Region region="Abdomen" selected={selected} onSelect={onSelect}><mesh castShadow rotation={[Math.PI/2,0,0]} scale={[.74,.44,.78]}><capsuleGeometry args={[.45,.72,10,18]} /><meshStandardMaterial color="#668ca4" roughness={.82} emissive={selected === "Abdomen" ? "#2c8d9a" : "#000"} emissiveIntensity={.28} transparent={anatomy} opacity={anatomy ? .42 : 1} /></mesh></Region></group>
    <Arm side="left" x={1.05} selected={selected} anatomy={anatomy} onSelect={onSelect} />
    <Arm side="right" x={-1.05} selected={selected} anatomy={anatomy} onSelect={onSelect} wound />
    <group position={[0,0,1.28]}><RoundedBox args={[1.65,.33,2.45]} radius={.2} castShadow><meshStandardMaterial color="#d9e8eb" roughness={.92} /></RoundedBox><mesh position={[0,.19,-.6]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[1.42,.55]} /><meshStandardMaterial color="#a9c9d1" /></mesh></group>
    <Leg side="Left" x={.43} selected={selected} anatomy={anatomy} onSelect={onSelect} />
    <Leg side="Right" x={-.43} selected={selected} anatomy={anatomy} onSelect={onSelect} />
  </group>;
}

function SkinMaterial({ selected, anatomy }: { selected: boolean; anatomy: boolean }) { return <meshStandardMaterial color="#c88f77" roughness={.82} emissive={selected ? "#338f9a" : "#000"} emissiveIntensity={selected ? .3 : 0} transparent={anatomy} opacity={anatomy ? .36 : 1} />; }

function Region({ region, selected, onSelect, children }: { region: string; selected: string | null; onSelect: (region: string) => void; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  useEffect(() => () => { document.body.style.cursor = ""; }, []);
  return <group onClick={e => { e.stopPropagation(); onSelect(region); }} onPointerOver={e => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }} onPointerOut={() => { setHovered(false); document.body.style.cursor = ""; }}>{children}{hovered && <Html center position={[0,.55,.2]}><span className="body-region-label">{region}</span></Html>}{(hovered || selected === region) && <mesh rotation={[-Math.PI/2,0,0]} position={[0,.28,0]}><ringGeometry args={[.42,.48,32]} /><meshBasicMaterial color="#55c9d5" transparent opacity={selected === region ? .65 : .35} side={THREE.DoubleSide} /></mesh>}</group>;
}

function Arm({ side, x, selected, anatomy, onSelect, wound = false }: { side: "left"|"right"; x: number; selected: string|null; anatomy:boolean; onSelect:(r:string)=>void; wound?:boolean }) {
  const label = side === "right" ? "Right arm" : "Left arm";
  return <group position={[x,.07,-.15]}><Region region={label} selected={selected} onSelect={onSelect}><mesh castShadow rotation={[Math.PI/2,0,0]} position={[0,0,-.35]}><capsuleGeometry args={[.18,.64,8,16]} /><SkinMaterial selected={selected===label} anatomy={anatomy} /></mesh><mesh castShadow rotation={[Math.PI/2,0,0]} position={[0,0,.43]}><capsuleGeometry args={[.15,.7,8,16]} /><SkinMaterial selected={selected===label} anatomy={anatomy} /></mesh><mesh castShadow position={[0,.01,.92]} scale={[.18,.12,.25]}><sphereGeometry args={[1,18,12]} /><SkinMaterial selected={selected===label} anatomy={anatomy} /></mesh>{wound && selected===label && <WoundTrainingPatch anatomy={anatomy} />}</Region></group>;
}

function Leg({ side, x, selected, anatomy, onSelect }: { side:"Left"|"Right";x:number;selected:string|null;anatomy:boolean;onSelect:(r:string)=>void }) {
  const label=`${side} leg`;
  return <group position={[x,-.04,1.65]}><Region region={label} selected={selected} onSelect={onSelect}><mesh rotation={[Math.PI/2,0,0]}><capsuleGeometry args={[.24,1.7,8,16]} /><SkinMaterial selected={selected===label} anatomy={anatomy} /></mesh></Region></group>;
}

function WoundTrainingPatch({ anatomy, position = [0, .14, .33] }: { anatomy:boolean; position?: [number, number, number] }) {
  const { state } = useSimulation();
  const anchor = useRef<THREE.Group>(null);
  useEffect(() => () => { surgerySite.ready = false; }, []);
  useFrame(() => {
    if (!anchor.current) return;
    anchor.current.updateWorldMatrix(true, false);
    surgerySite.matrixWorld.copy(anchor.current.matrixWorld);
    surgerySite.inverse.copy(anchor.current.matrixWorld).invert();
    surgerySite.normal.set(0, 1, 0).transformDirection(anchor.current.matrixWorld);
    surgerySite.ready = true;
  });
  return <group ref={anchor} position={position}><WoundSurface embedded incisionSegments={state.incisionSegments} incisionDepth={state.incisionDepth} incisionComplete={state.incisionComplete} stitchPhase={state.stitchPhase} stitchProgress={state.stitchProgress} suturePosition={state.suturePosition} anatomy={anatomy} />{anatomy && <ForearmAnatomy />}</group>;
}

function ForearmAnatomy(){return <group position={[0,.08,0]}><mesh position={[-.09,0,0]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.025,.025,.6,12]}/><meshStandardMaterial color="#eee5c9"/></mesh><mesh position={[.09,0,0]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.025,.025,.6,12]}/><meshStandardMaterial color="#eee5c9"/></mesh><Line points={[[-.14,.03,-.28],[-.12,.03,.28]]} color="#c6575d" lineWidth={2}/><Line points={[[.14,.03,-.28],[.11,.03,.28]]} color="#e1bc4f" lineWidth={1.5}/><Html position={[.28,.1,-.1]}><div className="anatomy-scene-labels"><span>Radius / ulna</span><span>Vessel path</span><span>Nerve path</span></div></Html></group>}

function TorsoAnatomy(){return <group position={[0,.18,.08]}><mesh position={[-.26,0,0]} scale={[.25,.13,.38]}><sphereGeometry args={[1,18,14]}/><meshStandardMaterial color="#df8f99" transparent opacity={.78}/></mesh><mesh position={[.26,0,0]} scale={[.25,.13,.38]}><sphereGeometry args={[1,18,14]}/><meshStandardMaterial color="#df8f99" transparent opacity={.78}/></mesh><mesh position={[0,.08,.05]} scale={[.18,.13,.23]} rotation={[0,0,-.2]}><sphereGeometry args={[1,18,14]}/><meshStandardMaterial color="#c94c58"/></mesh></group>}

export function FallbackNeedleHolder({ phase = 0 }: { phase?:number }) {
  return <group position={[.28+Math.min(phase,3)*-.07,.48,-.18+Math.min(phase,3)*.07]} rotation={[0,0,-.5+phase*.06]} scale={.36}><mesh position={[-.14,-.55,0]}><torusGeometry args={[.16,.045,8,20]}/><meshStandardMaterial color="#aeb9bd" metalness={.8}/></mesh><mesh position={[.14,-.55,0]}><torusGeometry args={[.16,.045,8,20]}/><meshStandardMaterial color="#aeb9bd" metalness={.8}/></mesh><mesh position={[-.06,.18,0]}><boxGeometry args={[.07,1.2,.07]}/><meshStandardMaterial color="#b8c3c7" metalness={.82}/></mesh><mesh position={[.06,.18,0]}><boxGeometry args={[.07,1.2,.07]}/><meshStandardMaterial color="#b8c3c7" metalness={.82}/></mesh><mesh position={[0,.8,0]}><boxGeometry args={[.13,.34,.08]}/><meshStandardMaterial color="#55cbd5" emissive="#2f8b95" emissiveIntensity={.25}/></mesh></group>;
}

export function FallbackMonitor(){return <group position={[2.95,2.35,-1.85]}><mesh castShadow><boxGeometry args={[1.28,.9,.28]}/><meshStandardMaterial color="#56636a" roughness={.4}/></mesh><mesh position={[0,.05,.15]}><planeGeometry args={[1.05,.62]}/><meshBasicMaterial color="#071a20"/></mesh><Line points={[[ -.48,.05,.161],[-.32,.05,.161],[-.25,.17,.161],[-.18,-.12,.161],[-.08,.08,.161],[.05,.05,.161],[.22,.05,.161],[.3,.16,.161],[.38,-.1,.161],[.48,.06,.161]]} color="#55dd8f" lineWidth={1.2}/><mesh position={[0,-.75,0]}><cylinderGeometry args={[.06,.08,.75,12]}/><meshStandardMaterial color="#6c777c" metalness={.4}/></mesh><Html position={[.32,.2,.18]} transform distanceFactor={7}><div className="monitor-readout"><strong>88</strong><span>98</span></div></Html></group>}

function IVStand(){return <group position={[-2.6,0,-1.65]}><mesh position={[0,1.55,0]}><cylinderGeometry args={[.025,.035,3.1,10]}/><meshStandardMaterial color="#8f9a9e" metalness={.7}/></mesh><mesh position={[0,3.02,0]}><boxGeometry args={[.65,.035,.035]}/><meshStandardMaterial color="#8f9a9e" metalness={.7}/></mesh><mesh position={[-.24,2.65,0]}><boxGeometry args={[.28,.52,.08]}/><meshPhysicalMaterial color="#d6eef0" transparent opacity={.55}/></mesh><Line points={[[ -.24,2.38,0],[-.24,1.65,0],[-1.05,1.45,.15]]} color="#98bdc2" lineWidth={.6}/><mesh rotation={[-Math.PI/2,0,0]} position={[0,.04,0]}><torusGeometry args={[.42,.025,8,24]}/><meshStandardMaterial color="#6f7b80" metalness={.6}/></mesh></group>}

function InstrumentTray({selectedTool, physical}:{selectedTool:string|null; physical?:boolean}){
  // when gesture tracking is live the tool is a rigid body owned by SurgicalPhysics, not tray dressing
  const asset = selectedTool && !physical ? TOOL_ASSETS[selectedTool] : undefined;
  return <group position={[2.8,1.05,-.62]}><mesh><boxGeometry args={[1.35,.06,.76]}/><meshStandardMaterial color="#aab6b9" metalness={.75} roughness={.25}/></mesh>{[-.48,.48].map(x=><mesh key={x} position={[x,-.58,0]}><cylinderGeometry args={[.03,.04,1.15,10]}/><meshStandardMaterial color="#717e83" metalness={.5}/></mesh>)}{!physical && (asset ? <SafeMedicalGLB path={asset.path} targetSize={.75} color="#bdc8cc" metalness={.84} roughness={.2} preserveTextures={false} position={[0,.13,0]} rotation={asset.rotation} fallback={<group />} /> : <><mesh position={[-.28,.07,0]} rotation={[0,.15,0]}><boxGeometry args={[.07,.04,.65]}/><meshStandardMaterial color="#c8d0d2" metalness={.8}/></mesh><mesh position={[.18,.07,.05]} rotation={[0,-.3,0]}><boxGeometry args={[.06,.04,.58]}/><meshStandardMaterial color="#c8d0d2" metalness={.8}/></mesh></>)}{selectedTool&&!physical&&<Html position={[0,.35,0]} center><span className="active-tray-label">{selectedTool} selected</span></Html>}</group>
}
