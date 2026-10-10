/** three.js materials that approximate each filament finish. */
import * as THREE from "three";
import type { ColorConfig } from "@config/materials";

export function makeMaterial(color: ColorConfig, clip?: THREE.Plane) {
  const common = { clippingPlanes: clip ? [clip] : [], clipShadows: true, side: THREE.DoubleSide, flatShading: false };
  switch (color.finish) {
    case "silk":
      return new THREE.MeshPhysicalMaterial({ ...common, color: color.hex, metalness: 0.75, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15 });
    case "translucent":
      return new THREE.MeshPhysicalMaterial({ ...common, color: color.hex, metalness: 0, roughness: 0.18, transmission: 0.85, thickness: 8, ior: 1.5, attenuationColor: new THREE.Color(color.hex), attenuationDistance: 40 });
    case "matte":
      return new THREE.MeshStandardMaterial({ ...common, color: color.hex, roughness: 0.92, metalness: 0 });
    case "wood":
      return new THREE.MeshStandardMaterial({ ...common, color: color.hex, roughness: 0.85, metalness: 0 });
    case "gradient":
      return new THREE.MeshStandardMaterial({ ...common, vertexColors: true, roughness: 0.85, metalness: 0 });
    default:
      return new THREE.MeshPhysicalMaterial({ ...common, color: color.hex, roughness: 0.45, metalness: 0.02, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  }
}

/** A multicolour print: the colour comes from each triangle (painted 3MF). */
export function makePaintMaterial(clip?: THREE.Plane) {
  return new THREE.MeshStandardMaterial({ clippingPlanes: clip ? [clip] : [], clipShadows: true, side: THREE.DoubleSide, vertexColors: true, roughness: 0.55, metalness: 0.02 });
}
