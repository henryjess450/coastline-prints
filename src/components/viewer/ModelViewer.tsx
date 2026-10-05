"use client";
// three.js objects (clip planes, materials) are imperative state that R3F
// mutates every frame inside useFrame. That's the intended pattern, so the
// compiler's immutability rule doesn't apply here.
/* eslint-disable react-hooks/immutability */
/**
 * STL viewer. Works in a Z-up "printer" frame (like slicers) inside a group
 * rotated into three.js's Y-up world. The model is centred on the bed, sits
 * on z = 0, and is shown in the orientation the printer will print it.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Grid, Lightformer, Line, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { ColorConfig } from "@config/materials";
import { orientationMatrix, type OrientationIndex } from "@/lib/printers/fit";
import type { BoundingBox, Vec3 } from "@/lib/stl/analyze";

export type ViewerProps = {
  modelKey: string;
  positions: Float32Array;
  normals: Float32Array;
  /** Bounding box of the raw file coordinates. */
  rawBox: BoundingBox;
  /** unitFactor × user scale, per original axis. */
  scale: Vec3;
  orientation: OrientationIndex;
  /** Final size on the bed (after orientation), mm. */
  bedSize: Vec3;
  color: ColorConfig;
  buildVolume: Vec3 | null;
  fits: boolean;
  showLabels?: boolean;
  /** Gentle turntable spin (landing page / admin thumbnails). */
  autoRotate?: boolean;
};

const Z_UP_TO_Y_UP = new THREE.Euler(-Math.PI / 2, 0, 0);

type LabelRefs = RefObject<(HTMLDivElement | null)[]>;

export default function ModelViewer(props: ViewerProps) {
  // Dimension labels are plain DOM nodes positioned every frame by projecting
  // 3D anchors (avoids drei <Html>, whose per-label React roots crash on unmount).
  const labelEls = useRef<(HTMLDivElement | null)[]>([]);
  const showLabels = props.showLabels ?? true;
  const { x, y, z } = props.bedSize;

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, 2]}

        camera={{ fov: 38, near: 0.5, far: 20000, position: [300, 260, 300] }}
        gl={{ antialias: true, alpha: true, localClippingEnabled: true } as THREE.WebGLRendererParameters}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
        }}
        aria-label="3D preview of your model"
        role="img"
      >
        <Scene {...props} labelEls={labelEls} />
      </Canvas>
      {showLabels && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {(
            [
              ["X", x],
              ["Y", y],
              ["Z", z],
            ] as const
          ).map(([axis, v], i) => (
            <div
              key={axis}
              ref={(el) => {
                labelEls.current[i] = el;
              }}
              style={{ opacity: 0 }}
              className="absolute left-0 top-0 whitespace-nowrap rounded-full border border-white/15 bg-black/75 px-2 py-0.5 font-mono text-[11px] tabular-nums text-white shadow-lg backdrop-blur will-change-transform"
            >
              <span className="text-white/55">{axis}</span> {v.toFixed(1)} mm
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Scene({
  modelKey,
  positions,
  normals,
  rawBox,
  scale,
  orientation,
  bedSize,
  color,
  buildVolume,
  fits,
  showLabels = true,
  autoRotate,
  labelEls,
}: ViewerProps & { labelEls: LabelRefs }) {
  const frame = buildVolume ?? bedSize;
  const boxMax = Math.max(frame.x, frame.y, frame.z);
  const modelMax = Math.max(bedSize.x, bedSize.y, bedSize.z);
  // Frame the model, using the build volume as context: small parts get a
  // close-up, oversized parts are framed whole.
  const radius = Math.max(Math.min(boxMax, Math.max(modelMax * 2.4, 40)), modelMax);
  // Re-frame only when the size changes a lot (not on every slider tick).
  const sizeBucket = Math.round(Math.log2(radius) * 2);

  return (
    <>
      <hemisphereLight args={["#ffffff", "#30304a", 0.9]} />
      <directionalLight position={[radius, radius * 2, radius * 0.8]} intensity={1.6} />
      <directionalLight position={[-radius, radius * 0.6, -radius]} intensity={0.5} color="#ffd9c2" />
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={2.5} position={[0, 5, -6]} scale={[12, 4, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#bff3ea" position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ffd9c2" position={[6, 2, 2]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
      </Environment>

      <Grid
        position={[0, -0.05, 0]}
        args={[frame.x, frame.y]}
        cellSize={10}
        cellThickness={0.6}
        cellColor="#6b6d7d"
        sectionSize={50}
        sectionThickness={1}
        sectionColor="#3d7bb8"
        fadeDistance={boxMax * 4}
        fadeStrength={1.5}
        infiniteGrid
      />
      <ContactShadows position={[0, 0.02, 0]} scale={boxMax * 1.2} blur={2.4} opacity={0.45} far={boxMax} />

      <group rotation={Z_UP_TO_Y_UP}>
        {buildVolume && <BuildVolume size={buildVolume} fits={fits} />}
        <Model
          modelKey={modelKey}
          positions={positions}
          normals={normals}
          rawBox={rawBox}
          scale={scale}
          orientation={orientation}
          bedSize={bedSize}
          color={color}
          fits={fits}
        />
        {showLabels && <Dimensions size={bedSize} fits={fits} labelEls={labelEls} />}
      </group>

      <CameraRig radius={radius} height={Math.max(bedSize.z, 20)} resetKey={`${modelKey}:${buildVolume?.x ?? 0}:${sizeBucket}`} autoRotate={autoRotate} />
    </>
  );
}

function Model({
  modelKey,
  positions,
  normals,
  rawBox,
  scale,
  orientation,
  bedSize,
  color,
  fits,
}: Pick<ViewerProps, "modelKey" | "positions" | "normals" | "rawBox" | "scale" | "orientation" | "bedSize" | "color" | "fits">) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    if (color.finish === "gradient") g.setAttribute("color", rainbowColors(positions, rawBox));
    g.computeBoundingSphere();
    return g;
  }, [positions, normals, rawBox, color.finish]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const quaternion = useMemo(() => {
    const m = orientationMatrix(orientation);
    const m4 = new THREE.Matrix4().set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
    return new THREE.Quaternion().setFromRotationMatrix(m4);
  }, [orientation]);

  const center: [number, number, number] = [
    -(rawBox.min.x + rawBox.max.x) / 2,
    -(rawBox.min.y + rawBox.max.y) / 2,
    -(rawBox.min.z + rawBox.max.z) / 2,
  ];

  // Layer-by-layer "printing" reveal: a clipping plane rises through the model.
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), []);
  const reveal = useRef({ start: 0, done: false });
  const sweep = useRef<THREE.Mesh>(null);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    reveal.current = { start: performance.now(), done: reduceMotion };
    clipPlane.constant = reduceMotion ? 1e6 : 0;
  }, [modelKey, clipPlane, reduceMotion]);

  useFrame(() => {
    const r = reveal.current;
    if (r.done) return;
    const t = Math.min(1, (performance.now() - r.start) / 1400);
    const eased = 1 - Math.pow(1 - t, 3);
    const h = bedSize.z * eased;
    clipPlane.constant = h + 0.01;
    if (sweep.current) {
      sweep.current.position.z = h;
      (sweep.current.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - t * t);
    }
    if (t >= 1) {
      r.done = true;
      clipPlane.constant = 1e6;
    }
  });

  const material = useMemo(() => makeMaterial(color, clipPlane), [color, clipPlane]);
  useEffect(() => () => material.dispose(), [material]);

  // When the part is too big, ghost it so the red build volume shows through.
  useEffect(() => {
    const ghost = !fits;
    if (color.finish === "translucent") return;
    material.transparent = ghost;
    material.opacity = ghost ? 0.45 : 1;
    material.depthWrite = !ghost;
    material.needsUpdate = true;
  }, [fits, material, color.finish]);

  return (
    <>
      <group position={[0, 0, bedSize.z / 2]} quaternion={quaternion}>
        <group scale={[scale.x, scale.y, scale.z]}>
          <mesh geometry={geometry} material={material} position={center} />
        </group>
      </group>
      {!reduceMotion && (
        <mesh ref={sweep} position={[0, 0, 0]}>
          <planeGeometry args={[bedSize.x * 1.08, bedSize.y * 1.08]} />
          <meshBasicMaterial color="#86bbea" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
    </>
  );
}

function makeMaterial(color: ColorConfig, clip: THREE.Plane) {
  const common = { clippingPlanes: [clip], clipShadows: true, side: THREE.DoubleSide, flatShading: false };
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

/** Rainbow along the model's original Z axis, for gradient spools. */
function rainbowColors(positions: Float32Array, box: BoundingBox) {
  const colors = new Float32Array(positions.length);
  const c = new THREE.Color();
  const h = box.size.z || 1;
  for (let i = 0; i < positions.length; i += 3) {
    const t = (positions[i + 2] - box.min.z) / h;
    c.setHSL((0.95 - t * 0.85 + 1) % 1, 0.75, 0.55);
    colors[i] = c.r;
    colors[i + 1] = c.g;
    colors[i + 2] = c.b;
  }
  return new THREE.BufferAttribute(colors, 3);
}

/** Translucent wireframe of the printer's build volume. Red + shake when it doesn't fit. */
function BuildVolume({ size, fits }: { size: Vec3; fits: boolean }) {
  const group = useRef<THREE.Group>(null);
  const lineMat = useRef<THREE.LineBasicMaterial>(null);
  const fillMat = useRef<THREE.MeshBasicMaterial>(null);
  const shakeStart = useRef(-1);
  const wasFitting = useRef(fits);
  const reduceMotion = usePrefersReducedMotion();

  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)), [size.x, size.y, size.z]);
  useEffect(() => () => edges.dispose(), [edges]);

  useEffect(() => {
    if (wasFitting.current && !fits && !reduceMotion) shakeStart.current = performance.now();
    wasFitting.current = fits;
  }, [fits, reduceMotion]);

  const target = useMemo(() => new THREE.Color(fits ? "#4f95d6" : "#ff3b4f"), [fits]);

  useFrame((_, dt) => {
    lineMat.current?.color.lerp(target, Math.min(1, dt * 8));
    fillMat.current?.color.lerp(target, Math.min(1, dt * 8));
    if (fillMat.current) fillMat.current.opacity = THREE.MathUtils.lerp(fillMat.current.opacity, fits ? 0.035 : 0.09, dt * 6);
    if (!group.current) return;
    if (shakeStart.current >= 0) {
      const t = (performance.now() - shakeStart.current) / 1000;
      group.current.position.x = Math.sin(t * 48) * size.x * 0.018 * Math.exp(-t * 6);
      if (t > 0.8) {
        shakeStart.current = -1;
        group.current.position.x = 0;
      }
    }
  });

  return (
    <group ref={group}>
      <group position={[0, 0, size.z / 2]}>
        <lineSegments geometry={edges}>
          <lineBasicMaterial ref={lineMat} color="#4f95d6" transparent opacity={0.9} />
        </lineSegments>
        <mesh>
          <boxGeometry args={[size.x, size.y, size.z]} />
          <meshBasicMaterial ref={fillMat} color="#4f95d6" transparent opacity={0.035} depthWrite={false} side={THREE.BackSide} />
        </mesh>
      </group>
      {/* Bed plate */}
      <mesh position={[0, 0, -0.6]}>
        <boxGeometry args={[size.x, size.y, 1.2]} />
        <meshStandardMaterial color="#5a5c6c" roughness={0.55} metalness={0.25} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

/** Measurement lines along the bed-aligned bounding box; drives the DOM labels. */
function Dimensions({ size, fits, labelEls }: { size: Vec3; fits: boolean; labelEls: LabelRefs }) {
  const group = useRef<THREE.Group>(null);
  const { camera, size: viewport } = useThree();
  const pad = Math.max(4, Math.max(size.x, size.y, size.z) * 0.06);
  const hx = size.x / 2, hy = size.y / 2;
  const col = fits ? "#86bbea" : "#ff5263";

  const anchors = useMemo(
    () => [
      new THREE.Vector3(0, -hy - pad * 1.8, 0),
      new THREE.Vector3(hx + pad * 1.8, 0, 0),
      new THREE.Vector3(hx + pad * 1.8, -hy - pad * 1.8, size.z),
    ],
    [hx, hy, pad, size.z],
  );
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const screen = useMemo(() => anchors.map(() => ({ x: 0, y: 0, w: 0, h: 0, on: false })), [anchors]);

  useFrame(() => {
    const g = group.current;
    const els = labelEls.current;
    if (!g || !els) return;
    anchors.forEach((a, i) => {
      const el = els[i];
      const p = screen[i];
      tmp.copy(a);
      g.localToWorld(tmp);
      tmp.project(camera);
      p.on = !!el && tmp.z < 1;
      p.x = ((tmp.x + 1) / 2) * viewport.width;
      p.y = ((1 - tmp.y) / 2) * viewport.height;
      p.w = el?.offsetWidth ?? 0;
      p.h = (el?.offsetHeight ?? 0) + 4;
    });
    // Nudge overlapping labels apart vertically (small models cluster them).
    for (let i = 1; i < screen.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = screen[i], b = screen[j];
        if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2) {
          a.y = a.y >= b.y ? b.y + (a.h + b.h) / 2 : b.y - (a.h + b.h) / 2;
        }
      }
    }
    screen.forEach((p, i) => {
      const el = els[i];
      if (!el) return;
      el.style.transform = `translate(-50%, -50%) translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      el.style.opacity = p.on ? "1" : "0";
    });
  });

  return (
    <group ref={group}>
      <Line points={[[-hx, -hy - pad, 0], [hx, -hy - pad, 0]]} color={col} lineWidth={1.5} dashed dashSize={3} gapSize={2} />
      <Line points={[[hx + pad, -hy, 0], [hx + pad, hy, 0]]} color={col} lineWidth={1.5} dashed dashSize={3} gapSize={2} />
      <Line points={[[hx + pad, -hy - pad, 0], [hx + pad, -hy - pad, size.z]]} color={col} lineWidth={1.5} dashed dashSize={3} gapSize={2} />
    </group>
  );
}

/** Eases the camera to frame the build volume whenever the model or printer changes. */
function CameraRig({ radius, height, resetKey, autoRotate }: { radius: number; height: number; resetKey: string; autoRotate?: boolean }) {
  const { camera } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const anim = useRef<{ from: THREE.Vector3; to: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; start: number } | null>(null);

  useEffect(() => {
    const dist = radius * 2.5;
    const to = new THREE.Vector3(dist * 0.75, dist * 0.62, dist * 0.95);
    const toT = new THREE.Vector3(0, Math.min(height, radius) * 0.45, 0);
    const c = controls.current;
    anim.current = { from: camera.position.clone(), to, fromT: c ? c.target.clone() : toT.clone(), toT, start: performance.now() };
    // Intentionally only when the model/printer changes, not on every resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useFrame(() => {
    const a = anim.current;
    if (!a) return;
    const t = Math.min(1, (performance.now() - a.start) / 900);
    const e = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(a.from, a.to, e);
    controls.current?.target.lerpVectors(a.fromT, a.toT, e);
    controls.current?.update();
    if (t >= 1) anim.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={radius * 0.3}
      maxDistance={radius * 6}
      maxPolarAngle={Math.PI * 0.495}
      autoRotate={autoRotate}
      autoRotateSpeed={0.8}
      onStart={() => (anim.current = null)}
    />
  );
}

function usePrefersReducedMotion() {
  return useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
}
