"use client";
import { create } from "zustand";
import type { MaterialId } from "@config/materials";
import { uploads } from "@config/site";
import type { AppConfig } from "@/lib/config/types";
import { maxUniformScale, usableVolume } from "@/lib/printers/fit";
import type { Vec3 } from "@/lib/stl/analyze";
import { INCHES_TO_MM, type ModelAnalysis } from "@/lib/stl/inspect";
import type { UploadDto } from "@/lib/uploads";
import type { ColorProfile, Filament } from "@/lib/model/threemf";
import { defaultColorMap, type ColorMap } from "@/lib/model/colors";
import type { SupportProfile } from "@/lib/model/supports";
import { filePalette } from "@/lib/model/palette";
import { parseInWorker, uploadStl } from "./client-stl";

/** A past order line to put back in the cart (from /api/account/orders/[token]/reorder). */
export type ReorderEntry = {
  upload: UploadDto;
  unitFactor: number;
  scale: Vec3;
  material: string;
  colorId: string;
  colorMap: ColorMap | null;
  quality: string;
  infill: string;
  quantity: number;
};

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
  /** 3MF only: filament number per triangle, and the project's filaments (for the colour preview). */
  fileColors?: { triColors: Uint8Array; filaments: Filament[]; used: number[]; shares: Record<number, number>; profile: ColorProfile } | null;
  analysis?: ModelAnalysis;
  /** Overhangs needing support, for each way up (from the local parse). */
  supports?: SupportProfile;
  /** Authoritative server stats, once the upload finishes. */
  upload?: UploadDto;
  unitFactor: number;
  scale: Vec3;
  lockAspect: boolean;
  material: MaterialId;
  /** Single colour (also what a painted file prints in when multicolour is off). */
  colorId: string;
  /** Painted 3MF printed in colour: file colour number → stock colour id. Null = one colour. */
  colorMap?: ColorMap | null;
  /** The colour picks from before switching to one colour, restored when switching back. */
  savedColorMap?: ColorMap | null;
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
  /** "Print it again": add files you've ordered before, with their old settings (already uploaded). */
  addReorder: (entries: ReorderEntry[], cfg: AppConfig) => number;
  /** Painted 3MF: print in its colours (matched to stock), or in one colour. */
  setMulticolour: (key: string, on: boolean, cfg: AppConfig) => void;
  /** Painted 3MF: which stock colour one of the file's colours prints in. */
  setColorFor: (key: string, filament: number, colorId: string) => void;
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

/** Closest in-stock colour for each colour in a painted file (keeping earlier picks that still exist). */
function matchColors(item: Pick<CartItem, "material">, fc: NonNullable<CartItem["fileColors"]>, cfg: AppConfig, keep?: ColorMap) {
  const colors = cfg.materials.find((m) => m.id === item.material)?.colors ?? [];
  return defaultColorMap(fc.used, (n) => filePalette(fc.filaments, fc.used)[n], colors, keep);
}

function firstColor(cfg: AppConfig, material: MaterialId) {
  return cfg.materials.find((m) => m.id === material)?.colors.find((c) => c.available)?.id ?? "";
}

let seq = 0;

export const useOrder = create<OrderState>((set, get) => {
  const patch = (key: string, p: Partial<CartItem> | ((i: CartItem) => Partial<CartItem>)) =>
    set((s) => ({ items: s.items.map((i) => (i.key === key ? { ...i, ...(typeof p === "function" ? p(i) : p) } : i)) }));

  async function ingest(key: string, file: File, cfg: AppConfig) {
    const buffer = await file.arrayBuffer();
    // Parse locally for the instant preview while the upload runs in parallel.
    const parsed = parseInWorker(key, buffer).then((r) => {
      if (!r.ok) throw new Error(r.error);
      // A painted file starts out in its own colours, matched to the closest stock colours.
      const painted = r.colors && r.colors.used.length > 1 ? r.colors : null;
      patch(key, (i) => ({
        positions: r.positions,
        normals: r.normals,
        fileColors: r.colors,
        supports: r.supports,
        analysis: r.analysis,
        phase: "uploading",
        colorMap: painted ? matchColors(i, painted, cfg) : null,
      }));
    });
    const uploaded = uploadStl(file, (f) => patch(key, { uploadProgress: f }));
    try {
      const [, upload] = await Promise.all([parsed, uploaded]);
      patch(key, { upload, phase: "ready", uploadProgress: 1 });
    } catch (err) {
      patch(key, { phase: "error", error: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  /** Fetches an already-uploaded file of yours and previews it; keeps the settings it was ordered with. */
  async function ingestExisting(key: string, uploadId: string, cfg: AppConfig) {
    try {
      const res = await fetch(`/api/account/files/${uploadId}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't load this file.");
      const r = await parseInWorker(key, await res.arrayBuffer());
      if (!r.ok) throw new Error(r.error);
      const painted = r.colors && r.colors.used.length > 1 ? r.colors : null;
      patch(key, (i) => ({
        positions: r.positions,
        normals: r.normals,
        fileColors: r.colors,
        supports: r.supports,
        analysis: r.analysis,
        phase: "ready",
        uploadProgress: 1,
        // Keep the colours it was printed in (any that are out of stock become the closest match).
        colorMap: painted && i.colorMap ? matchColors(i, painted, cfg, i.colorMap) : null,
      }));
    } catch (err) {
      patch(key, { phase: "error", error: err instanceof Error ? err.message : "Couldn't load this file." });
    }
  }

  return {
    items: [],
    selectedKey: null,
    rejected: [],

    addReorder(entries, cfg) {
      const room = uploads.maxFilesPerOrder - get().items.length;
      const added: CartItem[] = entries.slice(0, Math.max(0, room)).map((e) => {
        const material = (cfg.materials.some((m) => m.id === e.material) ? e.material : "PLA") as MaterialId;
        const inStock = cfg.materials.find((m) => m.id === material)?.colors.some((c) => c.id === e.colorId && c.available);
        return {
          key: `item-${Date.now()}-${seq++}`,
          fileName: e.upload.name,
          fileSize: e.upload.sizeBytes,
          phase: "parsing",
          uploadProgress: 1,
          upload: e.upload,
          unitFactor: e.unitFactor,
          scale: { ...e.scale },
          lockAspect: true,
          material,
          colorId: inStock ? e.colorId : firstColor(cfg, material),
          colorMap: e.colorMap,
          quality: cfg.qualityPresets.some((q) => q.id === e.quality) ? e.quality : "standard",
          infill: cfg.infillPresets.some((q) => q.id === e.infill) ? e.infill : "standard",
          quantity: Math.min(uploads.maxQuantityPerItem, Math.max(1, e.quantity)),
        };
      });
      if (!added.length) return 0;
      set((s) => ({ items: [...s.items, ...added], selectedKey: added[0].key, rejected: [] }));
      for (const it of added) void ingestExisting(it.key, it.upload!.id, cfg);
      return added.length;
    },

    addFiles(files, cfg) {
      const room = uploads.maxFilesPerOrder - get().items.length;
      const maxBytes = uploads.maxFileMb * 1024 * 1024;
      const rejected: string[] = [];
      const accepted: CartItem[] = [];
      const sources = new Map<string, File>();

      for (const file of files) {
        if (!/\.(stl|3mf)$/i.test(file.name)) rejected.push(`${file.name}: only .stl and .3mf files are supported.`);
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
      for (const [key, file] of sources) void ingest(key, file, cfg);
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
        const next = { ...i, material };
        return { material, colorId: keep ? i.colorId : firstColor(cfg, material), colorMap: i.colorMap && i.fileColors ? matchColors(next, i.fileColors, cfg, i.colorMap) : i.colorMap };
      });
    },

    setMulticolour(key, on, cfg) {
      patch(key, (i) =>
        on && i.fileColors && i.fileColors.used.length > 1
          ? { colorMap: matchColors(i, i.fileColors, cfg, i.savedColorMap ?? undefined) }
          : { colorMap: null, savedColorMap: i.colorMap ?? i.savedColorMap },
      );
    },

    setColorFor: (key, filament, colorId) => patch(key, (i) => (i.colorMap ? { colorMap: { ...i.colorMap, [filament]: colorId } } : {})),

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
