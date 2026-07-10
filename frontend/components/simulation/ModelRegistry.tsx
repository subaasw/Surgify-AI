"use client";

import { Bounds, useGLTF } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";

/**
 * Optional GLB loader for future licensed assets. The immersive MVP renders the
 * procedural fallbacks by default, so missing model files never affect it.
 */
export function ConfiguredGLB({ path, ...props }: { path: string } & Omit<ThreeElements["group"], "children">) {
  const gltf = useGLTF(path);
  return <group {...props}><Bounds fit clip observe margin={1.15}><primitive object={gltf.scene.clone()} /></Bounds></group>;
}

function Metal({ active = false }: { active?: boolean }) { return <meshStandardMaterial color={active ? "#59ccd6" : "#b8c4c8"} metalness={.8} roughness={.24} emissive={active ? "#246d76" : "#000"} emissiveIntensity={.3} />; }

export function FallbackForceps({ activeTip = false }: { activeTip?: boolean }) { return <group><mesh position={[-.1,0,0]} rotation={[0,0,-.04]}><boxGeometry args={[.08,2.6,.08]} /><Metal /></mesh><mesh position={[.1,0,0]} rotation={[0,0,.04]}><boxGeometry args={[.08,2.6,.08]} /><Metal /></mesh><mesh position={[-.04,1.42,0]}><coneGeometry args={[.06,.36,8]} /><Metal active={activeTip} /></mesh><mesh position={[.04,1.42,0]}><coneGeometry args={[.06,.36,8]} /><Metal active={activeTip} /></mesh></group>; }

export function FallbackScissors({ activeTip = false }: { activeTip?: boolean }) { return <group><mesh position={[-.26,-.95,0]}><torusGeometry args={[.24,.065,10,24]} /><Metal /></mesh><mesh position={[.26,-.95,0]}><torusGeometry args={[.24,.065,10,24]} /><Metal /></mesh><mesh position={[-.08,.28,0]} rotation={[0,0,-.05]}><boxGeometry args={[.09,2.1,.07]} /><Metal active={activeTip} /></mesh><mesh position={[.08,.28,0]} rotation={[0,0,.05]}><boxGeometry args={[.09,2.1,.07]} /><Metal active={activeTip} /></mesh></group>; }

export function FallbackCurvedNeedle() { return <group rotation={[0,0,.3]}><mesh><torusGeometry args={[.75,.035,10,48,Math.PI*1.25]} /><Metal active /></mesh><mesh position={[-.61,-.43,0]} rotation={[0,0,-.5]}><coneGeometry args={[.06,.25,8]} /><Metal active /></mesh></group>; }
