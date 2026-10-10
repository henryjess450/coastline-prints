"use client";
import { useMemo } from "react";
import type { ColorConfig } from "@config/materials";
import { useConfig } from "@/components/ConfigProvider";
import type { AppConfig } from "@/lib/config/types";
import { assignPrinter, type PrinterAssignment } from "@/lib/printers/fit";
import { computeMeshStats, type Vec3 } from "@/lib/stl/analyze";
import type { ItemSpec } from "@/lib/pricing/quote";
import { listNames, mappedColors } from "@/lib/model/colors";
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

/** What an item prints in, for display: "Red Matte" or "Red Matte, White and Black", with swatches. */
export function itemColors(item: CartItem, cfg: AppConfig) {
  const stock = cfg.materials.find((m) => m.id === item.material)?.colors ?? [];
  if (!item.colorMap) {
    const c = stock.find((x) => x.id === item.colorId);
    return { name: c?.name ?? "", hexes: c ? [c.hex] : [] };
  }
  const shares = item.upload?.colorInfo?.shares ?? item.fileColors?.shares;
  const mixed = mappedColors(item.colorMap, shares, stock);
  return { name: listNames(mixed.map((m) => m.color?.name ?? m.id)), hexes: mixed.map((m) => m.color?.hex ?? "#888888") };
}

/** Single colour, or the colour map with the file's colour shares (the server checks both). */
function colorSpec(item: CartItem): Pick<ItemSpec, "colorId" | "colorMap" | "colorShares" | "colorProfile"> {
  const shares = item.upload?.colorInfo?.shares ?? item.fileColors?.shares;
  if (!item.colorMap) return { colorId: item.colorId };
  // The most-covered colour stands in as "the" colour (e.g. for the send-off animation).
  const byShare = Object.entries(item.colorMap).sort((a, b) => (shares?.[Number(b[0])] ?? 0) - (shares?.[Number(a[0])] ?? 0));
  return { colorId: byShare[0]?.[1] ?? item.colorId, colorMap: item.colorMap, colorShares: shares, colorProfile: item.upload?.colorInfo?.profile ?? item.fileColors?.profile };
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
    ...colorSpec(item),
    supportProfile: item.upload?.supportInfo ?? item.supports ?? null,
    scale: s,
    quality: item.quality,
    infill: item.infill,
    quantity: item.quantity,
  };
}
