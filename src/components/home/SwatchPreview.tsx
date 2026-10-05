"use client";
/** A small turning sample vase in the chosen filament colour and finish. */
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ColorConfig } from "@config/materials";
import { makeMaterial } from "@/components/viewer/materials";
import { makeVaseGeometry, vaseRainbow } from "@/lib/home/vase";
import { useVisible } from "./useVisible";

export default function SwatchPreview({ color }: { color: ColorConfig }) {
  const [ref, visible] = useVisible<HTMLDivElement>();
  return (
    <div ref={ref} className="h-full w-full">
      <Canvas
        dpr={[1, 2]}
        frameloop={visible ? "always" : "never"}
        camera={{ fov: 30, near: 1, far: 2000, position: [0, 110, 380] }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ camera }) => camera.lookAt(0, 52, 0)}
        role="img"
        aria-label={`Sample print in ${color.name}`}
      >
        <hemisphereLight args={["#ffffff", "#30304a", 1]} />
        <directionalLight position={[160, 260, 200]} intensity={2} />
        <directionalLight position={[-200, 100, -150]} intensity={0.8} color="#ffd9c2" />
        <Environment resolution={64}>
          <Lightformer form="rect" intensity={2.5} position={[0, 5, -6]} scale={[12, 4, 1]} />
          <Lightformer form="rect" intensity={1.2} color="#bff3ea" position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        </Environment>
        <Sample color={color} />
      </Canvas>
    </div>
  );
}

function Sample({ color }: { color: ColorConfig }) {
  const reduce = useReducedMotion();
  const geometry = useMemo(() => {
    const g = makeVaseGeometry("low");
    if (color.finish === "gradient") vaseRainbow(g);
    return g;
  }, [color.finish]);
  const material = useMemo(() => makeMaterial(color), [color]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const group = useRef<THREE.Group>(null);
  const pop = useRef(0);
  useEffect(() => {
    pop.current = reduce ? 1 : 0;
  }, [color, reduce]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g || reduce) return;
    g.rotation.y += dt * 0.5;
    // A little hop each time the colour changes.
    pop.current = Math.min(1, pop.current + dt * 3);
    const p = pop.current;
    g.position.y = Math.sin(p * Math.PI) * 8;
    g.scale.setScalar(1 + Math.sin(p * Math.PI) * 0.04);
  });

  return (
    <group ref={group}>
      <mesh geometry={geometry} material={material} />
    </group>
  );
}
