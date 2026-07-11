"use client";

import { useMemo } from "react";
import { Line, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { INCISION_SEGMENTS } from "@/lib/handPhysics.mjs";

type WoundSurfaceProps = {
  incisionSegments: number[];
  incisionDepth: number;
  incisionComplete: boolean;
  stitchPhase: number;
  stitchProgress: number;
  suturePosition: number;
  anatomy: boolean;
  embedded?: boolean;
};

const ENTRY_X = -.14;
const EXIT_X = .14;
const INCISION_LENGTH = .58;
const INCISION_SEGMENT_LENGTH = INCISION_LENGTH / INCISION_SEGMENTS;
const incisionZ = (index: number) => -INCISION_LENGTH / 2 + INCISION_SEGMENT_LENGTH * (index + .5);

export function FallbackWound({ anatomy = false }: { anatomy?: boolean }) {
  return <RoundedBox args={[.56, .06, .82]} radius={.035} castShadow receiveShadow><meshPhysicalMaterial color="#d7a58d" roughness={.72} transparent={anatomy} opacity={anatomy ? .38 : 1} /></RoundedBox>;
}

export function WoundSurface({ incisionSegments, incisionDepth, incisionComplete, stitchPhase, stitchProgress, suturePosition, anatomy, embedded = false }: WoundSurfaceProps) {
  const stitchZ = THREE.MathUtils.lerp(-.2, .2, suturePosition / 100);
  const nerveAlignment = stitchPhase > 0 ? 1 : THREE.MathUtils.clamp(1 - Math.abs(suturePosition - 50) / 46, 0, 1);
  const nerveGap = THREE.MathUtils.lerp(.095, .028, nerveAlignment);
  const needleCurve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(ENTRY_X, .09, stitchZ),
    new THREE.Vector3(-.09, .01, stitchZ),
    new THREE.Vector3(0, -.025, stitchZ),
    new THREE.Vector3(.09, .01, stitchZ),
    new THREE.Vector3(EXIT_X, .09, stitchZ),
  ]), [stitchZ]);
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

    {!incisionComplete && Array.from({ length: INCISION_SEGMENTS }, (_, index) => !incisionSegments.includes(index) && <mesh key={index} position={[0, .068, incisionZ(index)]}><boxGeometry args={[.01, .003, INCISION_SEGMENT_LENGTH * .82]} /><meshBasicMaterial color="#42bed0" transparent opacity={.7} /></mesh>)}
    {!incisionComplete && incisionSegments.map(index => {
      const z = incisionZ(index);
      const gap = .024 + incisionDepth * 1.6;
      return <group key={index} position={[0, 0, z]}>
        <RoundedBox args={[gap, .016, INCISION_SEGMENT_LENGTH * .92]} radius={.007} position={[0, .052, 0]}><meshStandardMaterial color="#713b3d" roughness={.9} /></RoundedBox>
        <RoundedBox args={[.027, .02, INCISION_SEGMENT_LENGTH * .92]} radius={.008} position={[-gap / 2 - .014, .064, 0]} rotation={[0, 0, -.09]}><meshPhysicalMaterial color="#c98278" roughness={.74} /></RoundedBox>
        <RoundedBox args={[.027, .02, INCISION_SEGMENT_LENGTH * .92]} radius={.008} position={[gap / 2 + .014, .064, 0]} rotation={[0, 0, .09]}><meshPhysicalMaterial color="#c98278" roughness={.74} /></RoundedBox>
      </group>;
    })}

    {incisionComplete && <NerveRepairWindow gap={nerveGap} repaired={stitchPhase >= 3} />}

    {incisionComplete && stitchPhase < 2 && <>
      <TargetMarker x={ENTRY_X} z={stitchZ} color="#4dc5d2" />
      <TargetMarker x={EXIT_X} z={stitchZ} color="#55c783" />
      <Line points={[[ENTRY_X, .1, stitchZ], [0, -.015, stitchZ], [EXIT_X, .1, stitchZ]]} color="#74d6df" lineWidth={1.2} dashed dashSize={.035} gapSize={.022} transparent opacity={.55} />
    </>}

    {threadPoints.length > 1 && <Line points={threadPoints} color="#183d73" lineWidth={2.4} />}
    {stitchPhase >= 5 && <group position={[EXIT_X, .077, stitchZ]} scale={stitchPhase === 5 ? .75 + stitchProgress * .25 : 1}><mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.012, .0035, 8, 24]} /><meshStandardMaterial color="#183d73" roughness={.55} /></mesh><mesh rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[.01, .003, 8, 20]} /><meshStandardMaterial color="#183d73" roughness={.55} /></mesh></group>}
  </group>;
}

function NerveRepairWindow({ gap, repaired }: { gap: number; repaired: boolean }) {
  const length = .25 - gap;
  return <group>
    <RoundedBox args={[.29, .025, .6]} radius={.025} position={[0, .052, 0]}><meshStandardMaterial color="#733d43" roughness={.95} /></RoundedBox>
    <RoundedBox args={[.23, .018, .54]} radius={.018} position={[0, .07, 0]}><meshStandardMaterial color="#a8565c" roughness={.9} /></RoundedBox>
    {[-.08, -.04, 0, .04, .08].map((x, index) => <mesh key={x} position={[x, .082, 0]} rotation={[0, index % 2 ? .08 : -.08, 0]}><boxGeometry args={[.012, .005, .47]} /><meshStandardMaterial color={index % 2 ? "#c66f70" : "#8d454e"} roughness={1} /></mesh>)}
    {[-1, 1].map(side => <group key={side}>
      <mesh position={[0, .098, side * (gap + length / 2)]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.018, .018, length, 12]} /><meshStandardMaterial color="#e8c24e" roughness={.72} emissive="#6d5512" emissiveIntensity={.12} /></mesh>
      <mesh position={[0, .098, side * gap]}><sphereGeometry args={[.022, 14, 10]} /><meshStandardMaterial color="#f0cf5f" roughness={.68} /></mesh>
    </group>)}
    {repaired && <mesh position={[0, .098, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.017, .017, gap * 2, 12]} /><meshStandardMaterial color="#e8c24e" roughness={.72} /></mesh>}
    <RoundedBox args={[.12, .025, .58]} radius={.018} position={[-.18, .09, 0]} rotation={[0, 0, -.24]}><meshPhysicalMaterial color="#c98278" roughness={.78} /></RoundedBox>
    <RoundedBox args={[.12, .025, .58]} radius={.018} position={[.18, .09, 0]} rotation={[0, 0, .24]}><meshPhysicalMaterial color="#c98278" roughness={.78} /></RoundedBox>
  </group>;
}

function TargetMarker({ x, z, color }: { x: number; z: number; color: string }) {
  return <group position={[x, .075, z]}><mesh rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[.018, .026, 24]} /><meshBasicMaterial color={color} side={THREE.DoubleSide} /></mesh><mesh><sphereGeometry args={[.006, 10, 8]} /><meshBasicMaterial color={color} /></mesh></group>;
}
