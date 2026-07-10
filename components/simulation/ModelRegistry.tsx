"use client";

import { Component, Suspense, useMemo, type ErrorInfo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { useLoader, type ThreeElements } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

type MedicalGLBProps = Omit<ThreeElements["group"], "children"> & {
  path: string;
  targetSize?: number;
  color?: string;
  metalness?: number;
  roughness?: number;
  preserveTextures?: boolean;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  wireframe?: boolean;
};

/**
 * Loads, centers, scales, and safely colorizes project GLBs. Textured assets
 * keep their authored maps; untextured meshes receive the supplied material.
 */
export function MedicalGLB({
  path,
  targetSize = 3,
  color = "#b8c4c8",
  metalness = .12,
  roughness = .58,
  preserveTextures = true,
  emissive = "#000000",
  emissiveIntensity = 0,
  opacity = 1,
  wireframe = false,
  ...props
}: MedicalGLBProps) {
  const { scene } = useGLTF(path);
  const normalized = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const authoredMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const materials = authoredMaterials.map(authored => {
        const hasTexture = authored && "map" in authored && Boolean(authored.map);
        if (preserveTextures && hasTexture) {
          const material = authored.clone();
          if ("roughness" in material && typeof material.roughness === "number") material.roughness = Math.max(material.roughness, roughness);
          material.transparent = opacity < 1;
          material.opacity = opacity;
          material.depthWrite = opacity >= 1;
          (material as THREE.Material & { wireframe?: boolean }).wireframe = wireframe;
          return material;
        }
        return new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, wireframe });
      });
      object.material = Array.isArray(object.material) ? materials : materials[0];
    });
    clone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z) || 1;
    const scale = targetSize / longest;
    clone.scale.multiplyScalar(scale);
    clone.position.copy(center).multiplyScalar(-scale);
    return clone;
  }, [scene, targetSize, color, metalness, roughness, preserveTextures, emissive, emissiveIntensity, opacity, wireframe]);
  return <group {...props}><primitive object={normalized} /></group>;
}

/** Loads the user-supplied alternate patient FBX when the primary GLB fails. */
export function MedicalFBX({ path, targetSize = 3, color = "#c9937d", metalness = 0, roughness = .7, preserveTextures = true, opacity = 1, wireframe = false, ...props }: MedicalGLBProps) {
  const source = useLoader(FBXLoader, path);
  const normalized = useMemo(() => {
    const clone = source.clone(true);
    clone.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const authoredMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const materials = authoredMaterials.map(authored => {
        const hasTexture = authored && "map" in authored && Boolean(authored.map);
        if (preserveTextures && hasTexture) {
          const material = authored.clone();
          material.transparent = opacity < 1;
          material.opacity = opacity;
          material.depthWrite = opacity >= 1;
          (material as THREE.Material & { wireframe?: boolean }).wireframe = wireframe;
          return material;
        }
        return new THREE.MeshStandardMaterial({ color, metalness, roughness, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, wireframe });
      });
      object.material = Array.isArray(object.material) ? materials : materials[0];
    });
    clone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const scale = targetSize / (Math.max(size.x, size.y, size.z) || 1);
    clone.scale.multiplyScalar(scale);
    clone.position.copy(center).multiplyScalar(-scale);
    return clone;
  }, [source, targetSize, color, metalness, roughness, preserveTextures, opacity, wireframe]);
  return <group {...props}><primitive object={normalized} /></group>;
}

export class ModelErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV === "development") console.warn("3D asset fallback activated", error.message, info.componentStack);
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function SafeMedicalGLB({ fallback, ...props }: MedicalGLBProps & { fallback: ReactNode }) {
  return <ModelErrorBoundary fallback={fallback}><Suspense fallback={fallback}><MedicalGLB {...props} /></Suspense></ModelErrorBoundary>;
}

export function SafeMedicalFBX({ fallback, ...props }: MedicalGLBProps & { fallback: ReactNode }) {
  return <ModelErrorBoundary fallback={fallback}><Suspense fallback={fallback}><MedicalFBX {...props} /></Suspense></ModelErrorBoundary>;
}

function Metal({ active = false }: { active?: boolean }) { return <meshStandardMaterial color={active ? "#59ccd6" : "#b8c4c8"} metalness={.8} roughness={.24} emissive={active ? "#246d76" : "#000"} emissiveIntensity={.3} />; }

export function FallbackForceps({ activeTip = false }: { activeTip?: boolean }) { return <group><mesh position={[-.1,0,0]} rotation={[0,0,-.04]}><boxGeometry args={[.08,2.6,.08]} /><Metal /></mesh><mesh position={[.1,0,0]} rotation={[0,0,.04]}><boxGeometry args={[.08,2.6,.08]} /><Metal /></mesh><mesh position={[-.04,1.42,0]}><coneGeometry args={[.06,.36,8]} /><Metal active={activeTip} /></mesh><mesh position={[.04,1.42,0]}><coneGeometry args={[.06,.36,8]} /><Metal active={activeTip} /></mesh></group>; }
export function FallbackScissors({ activeTip = false }: { activeTip?: boolean }) { return <group><mesh position={[-.26,-.95,0]}><torusGeometry args={[.24,.065,10,24]} /><Metal /></mesh><mesh position={[.26,-.95,0]}><torusGeometry args={[.24,.065,10,24]} /><Metal /></mesh><mesh position={[-.08,.28,0]} rotation={[0,0,-.05]}><boxGeometry args={[.09,2.1,.07]} /><Metal active={activeTip} /></mesh><mesh position={[.08,.28,0]} rotation={[0,0,.05]}><boxGeometry args={[.09,2.1,.07]} /><Metal active={activeTip} /></mesh></group>; }
export function FallbackCurvedNeedle() { return <group rotation={[0,0,.3]}><mesh><torusGeometry args={[.75,.035,10,48,Math.PI*1.25]} /><Metal active /></mesh><mesh position={[-.61,-.43,0]} rotation={[0,0,-.5]}><coneGeometry args={[.06,.25,8]} /><Metal active /></mesh></group>; }
