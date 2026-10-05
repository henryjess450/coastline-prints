"use client";
import { useMemo } from "react";
import type { ColorConfig } from "@config/materials";
import { useConfig } from "@/components/ConfigProvider";
import type { AppConfig } from "@/lib/config/types";
import { assignPrinter, type PrinterAssignment } from "@/lib/printers/fit";
import { computeMeshStats, type Vec3 } from "@/lib/stl/analyze";
import type { ItemSpec } from "@/lib/pricing/quote";
import { isUniform, scaledSize, type CartItem } from "./store";

export type ItemDerived = {
  size: Vec3 | null;
  assignment: PrinterAssignment | null;
  color: ColorConfig;
  /** Build volume to draw around the model. */
  displayVolume: Vec3 | null;
};

export function deriveItem(item: CartItem, cfg: AppConfig): ItemDerived {
  const size = scaledSize(item);
  const mat = cfg.materials.find((m) => m.id === item.material) ?? cfg.materials[0];
  const color = mat.colors.find((c) => c.id === item.colorId) ?? mat.colors[0];
  if (!size) return { size, assignment: null, color, displayVolume: null };
  const assignment = assignPrinter(size, item.material, cfg.printers, cfg.safetyMarginMm);
  const shown = assignment.ok ? assignment.printer : assignment.largest;
  return { size, assignment, color, displayVolume: shown ? shown.buildVolume : null };
}

export function useDerived(item: CartItem | undefined) {
  const cfg = useConfig();
  return useMemo(() => (item ? deriveItem(item, cfg) : null), [item, cfg]);
}

/** Area of the scaled mesh. Uniform scale is exact without touching the vertices. */
const areaCache = new WeakMap<Float32Array, { key: string; area: number }>();

/** Pricing inputs for an item, from the local parse (mirrors the server's math). */
export function itemSpec(item: CartItem): ItemSpec | null {
  const size = scaledSize(item);
  const stats = item.analysis?.stats;
  if (!size || !stats) return null;
  const k = item.unitFactor;
  const s = { x: item.scale.x * k, y: item.scale.y * k, z: item.scale.z * k };
  let area: number;
  if (isUniform(item.scale)) area = stats.surfaceAreaMm2 * s.x * s.x;
  else if (item.positions) {
    const key = `${s.x}:${s.y}:${s.z}`;
    const hit = areaCache.get(item.positions);
    if (hit?.key === key) area = hit.area;
    else {
      area = computeMeshStats(item.positions, s).surfaceAreaMm2;
      areaCache.set(item.positions, { key, area });
    }
  } else return null;
  return {
    size,
    volumeMm3: stats.volumeMm3 * s.x * s.y * s.z,
    surfaceAreaMm2: area,
    material: item.material,
    colorId: item.colorId,
    quality: item.quality,
    infill: item.infill,
    quantity: item.quantity,
  };
}
