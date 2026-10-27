"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { bytes } from "@/lib/format";
import type { CartItemInput } from "@/lib/pricing/cart-schema";
import type { UploadDto } from "@/lib/uploads";
import { uploads as uploadLimits } from "@config/site";

export type Material = { id: string; name: string; colors: { id: string; name: string; hex: string }[] };
export type Preset = { id: string; name: string };
export type PrintOptions = { materials: Material[]; qualities: Preset[]; infills: Preset[] };
export type FileLine = { key: string; upload: UploadDto; material: string; colorId: string; quality: string; infill: string; quantity: number; scalePct: number; inches: boolean };

export const fieldInput = "h-11 w-full rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-accent-line";
export const fieldSelect = cn(fieldInput, "appearance-none pr-8");

/** The files as cart lines for the site's own price check. */
export const toCartItems = (files: FileLine[]): CartItemInput[] =>
  files.map((f) => ({
    uploadId: f.upload.id,
    unitFactor: f.inches ? 25.4 : 1,
    scale: { x: f.scalePct / 100, y: f.scalePct / 100, z: f.scalePct / 100 },
    material: f.material as CartItemInput["material"],
    colorId: f.colorId,
    quality: f.quality,
    infill: f.infill,
    quantity: f.quantity,
  }));

/** Upload STL/3MF files in the admin and set how each prints. Used by New order and the register. */
export function PrintFiles({ files, onChange, options, onError }: { files: FileLine[]; onChange: (update: (f: FileLine[]) => FileLine[]) => void; options: PrintOptions; onError: (msg: string) => void }) {
  const { materials, qualities, infills } = options;
  const [uploading, setUploading] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const set = (key: string, patch: Partial<FileLine>) => onChange((f) => f.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  async function addFiles(list: FileList | null) {
    let room = uploadLimits.maxFilesPerOrder - files.length - uploading.length;
    for (const file of Array.from(list ?? [])) {
      if (room-- <= 0) break;
      setUploading((u) => [...u, file.name]);
      try {
        const res = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Filename": encodeURIComponent(file.name) }, body: file });
        const body = await res.json();
        if (!res.ok) {
          onError(`${file.name}: ${body.error ?? "couldn't upload it."}`);
          continue;
        }
        const m = materials[0];
        onChange((f) => [...f, { key: crypto.randomUUID(), upload: body.upload, material: m.id, colorId: m.colors[0]?.id ?? "", quality: qualities.find((q) => q.id === "standard")?.id ?? qualities[0].id, infill: infills.find((i) => i.id === "standard")?.id ?? infills[0].id, quantity: 1, scalePct: 100, inches: false }]);
      } catch {
        onError(`${file.name}: the upload didn't finish.`);
      } finally {
        setUploading((u) => u.filter((n) => n !== file.name));
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div className="space-y-3">
      {files.map((f) => {
        const mat = materials.find((m) => m.id === f.material) ?? materials[0];
        const s = (f.scalePct / 100) * (f.inches ? 25.4 : 1);
        return (
          <div key={f.key} className="rounded-2xl border border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{f.upload.name}</p>
                <p className="text-xs text-faint">
                  {bytes(f.upload.sizeBytes)} · {(f.upload.size.x * s).toFixed(0)} × {(f.upload.size.y * s).toFixed(0)} × {(f.upload.size.z * s).toFixed(0)} mm
                </p>
              </div>
              <button type="button" onClick={() => onChange((l) => l.filter((x) => x.key !== f.key))} className="text-sm text-muted hover:text-danger">
                Remove
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Field label="Material">
                <select className={fieldSelect} value={f.material} onChange={(e) => set(f.key, { material: e.target.value, colorId: materials.find((m) => m.id === e.target.value)?.colors[0]?.id ?? "" })}>
                  {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </Field>
              <Field label="Colour">
                <select className={fieldSelect} value={f.colorId} onChange={(e) => set(f.key, { colorId: e.target.value })}>
                  {mat.colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Quality">
                <select className={fieldSelect} value={f.quality} onChange={(e) => set(f.key, { quality: e.target.value })}>
                  {qualities.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
                </select>
              </Field>
              <Field label="Infill">
                <select className={fieldSelect} value={f.infill} onChange={(e) => set(f.key, { infill: e.target.value })}>
                  {infills.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </Field>
              <Field label="Size (%)">
                <input className={fieldInput} type="number" min={1} max={1000} value={f.scalePct} onChange={(e) => set(f.key, { scalePct: Math.max(1, Number(e.target.value) || 100) })} />
              </Field>
              <Field label="How many">
                <input className={fieldInput} type="number" min={1} max={uploadLimits.maxQuantityPerItem} value={f.quantity} onChange={(e) => set(f.key, { quantity: Math.min(uploadLimits.maxQuantityPerItem, Math.max(1, Math.floor(Number(e.target.value)) || 1)) })} />
              </Field>
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={f.inches} onChange={(e) => set(f.key, { inches: e.target.checked })} /> Modelled in inches
            </label>
          </div>
        );
      })}
      {uploading.map((n) => (
        <p key={n} className="animate-pulse rounded-2xl border border-dashed border-line p-4 text-sm text-muted">Uploading {n}...</p>
      ))}
      <input ref={fileInput} type="file" accept=".stl,.3mf" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={files.length + uploading.length >= uploadLimits.maxFilesPerOrder}>
        {files.length ? "Add another file" : "Choose STL or 3MF"}
      </Button>
    </div>
  );
}

export function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={cn("block", wide && "sm:col-span-2")}>
      <span className="mb-1 block px-1 text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
