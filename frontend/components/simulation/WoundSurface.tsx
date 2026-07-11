"use client";

import { useMemo } from "react";
import { Line, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

type WoundSurfaceProps = {
  incisionProgress: number;
  incisionComplete: boolean;
  stitchPhase: number;
  stitchProgress: number;
  suturePosition: number;
  sutureAngle: number;
  anatomy: boolean;
  selectedTool: string | null;
  embedded?: boolean;
};

const ENTRY_X = -.14;
const EXIT_X = .14;

export function FallbackWound({ anatomy = false }: { anatomy?: boolean }) {
  return <RoundedBox args={[.56, .06, .82]} radius={.035} castShadow receiveShadow><meshPhysicalMaterial color="#d7a58d" roughness={.72} transparent={anatomy} opacity={anatomy ? .38 : 1} /></RoundedBox>;
}

export function WoundSurface({ incisionProgress, incisionComplete, stitchPhase, stitchProgress, suturePosition, sutureAngle, anatomy, selectedTool, embedded = false }: WoundSurfaceProps) {
  const cutLength = Math.max(.018, incisionProgress * .58);
  const cutCenter = -.29 + cutLength / 2;
  const stitchZ = THREE.MathUtils.lerp(-.2, .2, suturePosition / 100);
  const knotTightness = stitchPhase > 4 ? 1 : stitchPhase === 4 ? stitchProgress : 0;
  const gap = .032 - knotTightness * .02;
  const needleCurve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(ENTRY_X, .09, stitchZ),
    new THREE.Vector3(-.09, .01, stitchZ),
    new THREE.Vector3(0, -.025, stitchZ),
    new THREE.Vector3(.09, .01, stitchZ),
    new THREE.Vector3(EXIT_X, .09, stitchZ),
  ]), [stitchZ]);
  const needlePoint = needleCurve.getPoint(stitchPhase === 2 ? stitchProgress : stitchPhase > 2 ? 1 : 0);
  const threadPoints = useMemo(() => {
    if (stitchPhase < 2) return [];
    if (stitchPhase === 2) return Array.from({ length: 18 }, (_, index) => needleCurve.getPoint(index / 17 * Math.max(.02, stitchProgress)));
    if (stitchPhase === 3) {
      const lift = .05 + (1 - stitchProgress) * .16;
      return [new THREE.Vector3(ENTRY_X, .065, stitchZ), new THREE.Vector3(0, lift, stitchZ), new THREE.Vector3(EXIT_X, .065, stitchZ), new THREE.Vector3(.22, lift + .03, stitchZ + .1)];
    }
    const tail = stitchPhase >= 6 ? .035 : .13 - stitchProgress * .07;
    return [new THREE.Vector3(ENTRY_X, .068, stitchZ), new THREE.Vector3(0, .045, stitchZ), new THREE.Vector3(EXIT_X, .068, stitchZ), new THREE.Vector3(EXIT_X + tail, .08 + tail * .3, stitchZ + tail * .45)];
  }, [needleCurve, stitchPhase, stitchProgress, stitchZ]);

  return <group>
    {!embedded && <><FallbackWound anatomy={anatomy} /><mesh position={[0, .033, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.48, .72]} /><meshPhysicalMaterial color="#e0b09a" roughness={.82} clearcoat={.08} transparent={anatomy} opacity={anatomy ? .25 : .96} /></mesh></>}

    {!incisionComplete && Array.from({ length: 8 }, (_, index) => <mesh key={index} position={[0, .068, -.255 + index * .073]}><boxGeometry args={[.012, .003, .038]} /><meshBasicMaterial color="#42bed0" transparent opacity={.7} /></mesh>)}
    {incisionProgress > 0 && <>
      <RoundedBox args={[gap, .018, cutLength]} radius={.008} position={[0, .052, cutCenter]}><meshStandardMaterial color="#713b3d" roughness={.9} /></RoundedBox>
      <RoundedBox args={[.034, .025, cutLength]} radius={.012} position={[-gap / 2 - .018, .065, cutCenter]} rotation={[0, 0, -.08 * (1 - knotTightness)]}><meshPhysicalMaterial color="#c98278" roughness={.74} /></RoundedBox>
      <RoundedBox args={[.034, .025, cutLength]} radius={.012} position={[gap / 2 + .018, .065, cutCenter]} rotation={[0, 0, .08 * (1 - knotTightness)]}><meshPhysicalMaterial color="#c98278" roughness={.74} /></RoundedBox>
      <mesh position={[0, .063, cutCenter]}><boxGeometry args={[gap * .55, .004, cutLength * .92]} /><meshBasicMaterial color="#b65f5b" transparent opacity={.38} /></mesh>
    </>}

    {incisionComplete && stitchPhase < 2 && <>
      <TargetMarker x={ENTRY_X} z={stitchZ} color="#4dc5d2" />
      <TargetMarker x={EXIT_X} z={stitchZ} color="#55c783" />
      <Line points={[[ENTRY_X, .1, stitchZ], [0, -.015, stitchZ], [EXIT_X, .1, stitchZ]]} color="#74d6df" lineWidth={1.2} dashed dashSize={.035} gapSize={.022} transparent opacity={.55} />
    </>}

    {selectedTool === "Scalpel" && !incisionComplete && <Scalpel progress={incisionProgress} />}
    {selectedTool === "Needle holder" && stitchPhase < 5 && <NeedleHolder point={needlePoint} phase={stitchPhase} progress={stitchProgress} angle={sutureAngle} />}
    {selectedTool === "Surgical scissors" && stitchPhase === 5 && <Scissors z={stitchZ} progress={stitchProgress} />}
    {threadPoints.length > 1 && <Line points={threadPoints} color="#183d73" lineWidth={2.4} />}
    {stitchPhase >= 5 && <group position={[EXIT_X, .077, stitchZ]} scale={stitchPhase === 5 ? .75 + stitchProgress * .25 : 1}><mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.012, .0035, 8, 24]} /><meshStandardMaterial color="#183d73" roughness={.55} /></mesh><mesh rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[.01, .003, 8, 20]} /><meshStandardMaterial color="#183d73" roughness={.55} /></mesh></group>}
  </group>;
}

function TargetMarker({ x, z, color }: { x: number; z: number; color: string }) {
  return <group position={[x, .075, z]}><mesh rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[.018, .026, 24]} /><meshBasicMaterial color={color} side={THREE.DoubleSide} /></mesh><mesh><sphereGeometry args={[.006, 10, 8]} /><meshBasicMaterial color={color} /></mesh></group>;
}

function Scalpel({ progress }: { progress: number }) {
  const z = -.29 + progress * .58;
  return <group position={[0, .16, z]} rotation={[.48, 0, 0]}><RoundedBox args={[.045, .045, .32]} radius={.012} position={[0, .04, -.16]}><meshStandardMaterial color="#70818c" metalness={.68} roughness={.35} /></RoundedBox><mesh position={[0, -.006, .035]}><boxGeometry args={[.008, .07, .12]} /><meshStandardMaterial color="#d8e1e5" metalness={.92} roughness={.14} /></mesh><mesh position={[0, -.045, .088]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[.008, .06, .06]} /><meshStandardMaterial color="#eef3f4" metalness={.95} roughness={.08} /></mesh></group>;
}

function NeedleHolder({ point, phase, progress, angle }: { point: THREE.Vector3; phase: number; progress: number; angle: number }) {
  const position = phase === 3 ? new THREE.Vector3(.27, .23 + progress * .08, point.z + .08) : point.clone().add(new THREE.Vector3(-.02, .22, -.02));
  const rotation = THREE.MathUtils.degToRad(angle - 52);
  return <group position={position} rotation={[.2, rotation, -.64 - (phase === 2 ? progress * .7 : 0)]}>
    <mesh position={[-.055, .22, 0]}><boxGeometry args={[.035, .48, .03]} /><meshStandardMaterial color="#b8c4c9" metalness={.86} roughness={.2} /></mesh>
    <mesh position={[.055, .22, 0]}><boxGeometry args={[.035, .48, .03]} /><meshStandardMaterial color="#b8c4c9" metalness={.86} roughness={.2} /></mesh>
    <mesh position={[-.065, .5, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.075, .018, 8, 20]} /><meshStandardMaterial color="#aebbc0" metalness={.88} roughness={.18} /></mesh>
    <mesh position={[.065, .5, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.075, .018, 8, 20]} /><meshStandardMaterial color="#aebbc0" metalness={.88} roughness={.18} /></mesh>
    <mesh position={[0, -.045, 0]} rotation={[Math.PI / 2, 0, phase === 2 ? progress * Math.PI : 0]}><torusGeometry args={[.085, .005, 8, 30, Math.PI * 1.35]} /><meshStandardMaterial color="#dfe6e8" metalness={.95} roughness={.1} /></mesh>
  </group>;
}

function Scissors({ z, progress }: { z: number; progress: number }) {
  const close = progress * .18;
  return <group position={[.22, .19, z + .05]} rotation={[.2, 0, -.65]}><mesh rotation={[0, 0, -.16 + close]} position={[-.025, -.12, 0]}><boxGeometry args={[.025, .42, .024]} /><meshStandardMaterial color="#c1ccd0" metalness={.9} roughness={.16} /></mesh><mesh rotation={[0, 0, .16 - close]} position={[.025, -.12, 0]}><boxGeometry args={[.025, .42, .024]} /><meshStandardMaterial color="#c1ccd0" metalness={.9} roughness={.16} /></mesh>{[-.07, .07].map(x => <mesh key={x} position={[x, .16, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.065, .016, 8, 20]} /><meshStandardMaterial color="#aebbc0" metalness={.88} roughness={.2} /></mesh>)}</group>;
}
