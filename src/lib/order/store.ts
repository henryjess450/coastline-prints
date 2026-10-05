"use client";
import { create } from "zustand";
import type { MaterialId } from "@config/materials";
import { uploads } from "@config/site";
import type { AppConfig } from "@/lib/config/types";
import { maxUniformScale, usableVolume } from "@/lib/printers/fit";
import type { Vec3 } from "@/lib/stl/analyze";
import { INCHES_TO_MM, type ModelAnalysis } from "@/lib/stl/inspect";
import type { UploadDto } from "@/lib/uploads";
import { parseInWorker, uploadStl } from "./client-stl";

export type ItemPhase = "parsing" | "uploading" | "ready" | "error";

export type CartItem = {
  key: string;
  fileName: string;
  fileSize: number;
  phase: ItemPhase;
  uploadProgress: number;
  error?: string;
  positions?: Float32Array;
  normals?: Float32Array;
  analysis?: ModelAnalysis;
  /** Authoritative server stats, once the upload finishes. */
  upload?: UploadDto;
  unitFactor: number;
  scale: Vec3;
  lockAspect: boolean;
  material: MaterialId;
  colorId: string;
  quality: string;
  infill: string;
  quantity: number;
};

type OrderState = {
  items: CartItem[];
  selectedKey: string | null;
  rejected: string[];
  addFiles: (files: File[], cfg: AppConfig) => void;
  remove: (key: string) => void;
  select: (key: string) => void;
  update: (key: string, patch: Partial<CartItem>) => void;
  setUniformScale: (key: string, factor: number) => void;
  setDimension: (key: string, axis: keyof Vec3, mm: number) => void;
  toggleInches: (key: string) => void;
  fitToMax: (key: string, cfg: AppConfig) => void;
  resetSize: (key: string) => void;
  setMaterial: (key: string, material: MaterialId, cfg: AppConfig) => void;
  dismissRejected: () => void;
  /** Empties the cart (after a successful payment). */
  reset: () => void;
};

const ONE: Vec3 = { x: 1, y: 1, z: 1 };
const MIN_DIM_MM = 1;

/** Original model size in mm (after the inches fix, before scaling). */
export function baseSize(item: CartItem): Vec3 | null {
  const s = item.upload?.size ?? item.analysis?.stats.bbox.size;
  if (!s) return null;
  return { x: s.x * item.unitFactor, y: s.y * item.unitFactor, z: s.z * item.unitFactor };
}

export function scaledSize(item: CartItem): Vec3 | null {
  const b = baseSize(item);
  if (!b) return null;
  return { x: b.x * item.scale.x, y: b.y * item.scale.y, z: b.z * item.scale.z };
}

export function isUniform(scale: Vec3) {
  return Math.abs(scale.x - scale.y) < 1e-9 && Math.abs(scale.y - scale.z) < 1e-9;
}

function firstColor(cfg: AppConfig, material: MaterialId) {
  return cfg.materials.find((m) => m.id === material)?.colors.find((c) => c.available)?.id ?? "";
}

let seq = 0;

export const useOrder = create<OrderState>((set, get) => {
  const patch = (key: string, p: Partial<CartItem> | ((i: CartItem) => Partial<CartItem>)) =>
    set((s) => ({ items: s.items.map((i) => (i.key === key ? { ...i, ...(typeof p === "function" ? p(i) : p) } : i)) }));

  async function ingest(key: string, file: File) {
    const buffer = await file.arrayBuffer();
    // Parse locally for the instant preview while the upload runs in parallel.
    const parsed = parseInWorker(key, buffer).then((r) => {
      if (!r.ok) throw new Error(r.error);
      patch(key, { positions: r.positions, normals: r.normals, analysis: r.analysis, phase: "uploading" });
    });
    const uploaded = uploadStl(file, (f) => patch(key, { uploadProgress: f }));
    try {
      const [, upload] = await Promise.all([parsed, uploaded]);
      patch(key, { upload, phase: "ready", uploadProgress: 1 });
    } catch (err) {
      patch(key, { phase: "error", error: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  return {
    items: [],
    selectedKey: null,
    rejected: [],

    addFiles(files, cfg) {
      const room = uploads.maxFilesPerOrder - get().items.length;
      const maxBytes = uploads.maxFileMb * 1024 * 1024;
      const rejected: string[] = [];
      const accepted: CartItem[] = [];
      const sources = new Map<string, File>();

      for (const file of files) {
        if (!/\.stl$/i.test(file.name)) rejected.push(`${file.name}: only .stl files are supported.`);
        else if (file.size > maxBytes) rejected.push(`${file.name}: larger than ${uploads.maxFileMb} MB.`);
        else if (accepted.length >= room) rejected.push(`${file.name}: up to ${uploads.maxFilesPerOrder} files per order.`);
        else {
          const key = `item-${Date.now()}-${seq++}`;
          sources.set(key, file);
          accepted.push({
            key,
            fileName: file.name,
            fileSize: file.size,
            phase: "parsing",
            uploadProgress: 0,
            unitFactor: 1,
            scale: { ...ONE },
            lockAspect: true,
            material: "PLA",
            colorId: firstColor(cfg, "PLA"),
            quality: "standard",
            infill: "standard",
            quantity: 1,
          });
        }
      }

      set((s) => ({
        items: [...s.items, ...accepted],
        selectedKey: accepted[0]?.key ?? s.selectedKey,
        rejected,
      }));
      for (const [key, file] of sources) void ingest(key, file);
    },

    remove(key) {
      set((s) => {
        const items = s.items.filter((i) => i.key !== key);
        return { items, selectedKey: s.selectedKey === key ? (items[0]?.key ?? null) : s.selectedKey };
      });
    },

    select: (key) => set({ selectedKey: key }),
    update: (key, p) => patch(key, p),

    setUniformScale(key, factor) {
      if (!(factor > 0)) return;
      patch(key, (i) => {
        // Keep any non-uniform proportions; scale them all relative to X.
        const r = factor / i.scale.x;
        return { scale: clampScale(i, { x: i.scale.x * r, y: i.scale.y * r, z: i.scale.z * r }) };
      });
    },

    setDimension(key, axis, mm) {
      patch(key, (i) => {
        const base = baseSize(i);
        if (!base || !(mm > 0) || base[axis] === 0) return {};
        const target = mm / base[axis];
        if (!i.lockAspect) return { scale: clampScale(i, { ...i.scale, [axis]: target }) };
        const r = target / i.scale[axis];
        return { scale: clampScale(i, { x: i.scale.x * r, y: i.scale.y * r, z: i.scale.z * r }) };
      });
    },

    toggleInches(key) {
      patch(key, (i) => ({ unitFactor: i.unitFactor === 1 ? INCHES_TO_MM : 1, scale: { ...ONE } }));
    },

    fitToMax(key, cfg) {
      patch(key, (i) => {
        const size = scaledSize(i);
        if (!size) return {};
        const capable = cfg.printers.filter((p) => p.materials.includes(i.material));
        let best = 0;
        for (const p of capable) best = Math.max(best, maxUniformScale(size, usableVolume(p, cfg.safetyMarginMm)));
        if (!best) return {};
        const k = best * 0.999; // stay a hair inside the limit after rounding
        return { scale: { x: i.scale.x * k, y: i.scale.y * k, z: i.scale.z * k } };
      });
    },

    resetSize: (key) => patch(key, { scale: { ...ONE } }),

    setMaterial(key, material, cfg) {
      patch(key, (i) => {
        const mat = cfg.materials.find((m) => m.id === material);
        const keep = mat?.colors.some((c) => c.id === i.colorId && c.available);
        return { material, colorId: keep ? i.colorId : firstColor(cfg, material) };
      });
    },

    dismissRejected: () => set({ rejected: [] }),
    reset: () => set({ items: [], selectedKey: null, rejected: [] }),
  };
});

/** Prevent scaling below 1 mm on any axis (unprintable, and breaks the math). */
function clampScale(item: CartItem, scale: Vec3): Vec3 {
  const base = baseSize(item);
  if (!base) return scale;
  const minFactor = Math.max(
    base.x > 0 ? MIN_DIM_MM / (base.x * scale.x) : 0,
    base.y > 0 ? MIN_DIM_MM / (base.y * scale.y) : 0,
    base.z > 0 ? MIN_DIM_MM / (base.z * scale.z) : 0,
  );
  if (minFactor <= 1) return scale;
  return item.lockAspect || isUniform(scale)
    ? { x: scale.x * minFactor, y: scale.y * minFactor, z: scale.z * minFactor }
    : {
        x: Math.max(scale.x, base.x > 0 ? MIN_DIM_MM / base.x : scale.x),
        y: Math.max(scale.y, base.y > 0 ? MIN_DIM_MM / base.y : scale.y),
        z: Math.max(scale.z, base.z > 0 ? MIN_DIM_MM / base.z : scale.z),
      };
}
