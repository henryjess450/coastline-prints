"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useActionState, useState } from "react";
import type { ColorConfig, ColorFinish, MaterialConfig } from "@config/materials";
import { saveMaterialsAction, type ActionState } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const FINISHES: ColorFinish[] = ["solid", "matte", "silk", "translucent", "wood", "gradient"];
const field = "h-9 rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-accent-line";

function slug(name: string, taken: string[]) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 34) || "colour";
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}

export function MaterialsEditor({ materials: initial }: { materials: MaterialConfig[] }) {
  const [materials, setMaterials] = useState(initial);
  const [open, setOpen] = useState(initial[0]?.id);
  const [state, action, pending] = useActionState<ActionState, FormData>(saveMaterialsAction, {});

  const patchMaterial = (id: string, p: Partial<MaterialConfig>) => setMaterials((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m)));
  const patchColor = (mid: string, cid: string, p: Partial<ColorConfig>) =>
    setMaterials((ms) => ms.map((m) => (m.id === mid ? { ...m, colors: m.colors.map((c) => (c.id === cid ? { ...c, ...p } : c)) } : m)));

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="materials" value={JSON.stringify(materials)} />
      <div className="flex flex-wrap gap-2">
        {materials.map((m) => (
          <button key={m.id} type="button" onClick={() => setOpen(m.id)} className={cn("rounded-full border px-4 py-1.5 text-sm", open === m.id ? "border-accent-line bg-accent text-accent-ink" : "border-line text-muted hover:text-fg")}>
            {m.name} <span className="opacity-70">({m.colors.filter((c) => c.available).length})</span>
          </button>
        ))}
      </div>

      {materials
        .filter((m) => m.id === open)
        .map((m) => (
          <div key={m.id} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
              <label className="block text-xs text-muted">
                Description
                <input value={m.description} onChange={(e) => patchMaterial(m.id, { description: e.target.value })} className={cn(field, "mt-1 w-full")} maxLength={300} />
              </label>
              <label className="block text-xs text-muted">
                Density (g/cm³)
                <input type="number" step="0.01" min="0.5" max="3" value={m.densityGPerCm3} onChange={(e) => patchMaterial(m.id, { densityGPerCm3: Number(e.target.value) })} className={cn(field, "mt-1 w-full font-mono")} />
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="text-left text-xs text-faint">
                  <tr>
                    <th className="pb-2 font-medium">Colour</th>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Finish</th>
                    <th className="pb-2 font-medium">Own ¢/g</th>
                    <th className="pb-2 font-medium">In stock</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {m.colors.map((c) => (
                      <motion.tr key={c.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="border-t border-line">
                        <td className="py-2 pr-2">
                          <span className="flex items-center gap-2">
                            <input type="color" aria-label={`${c.name} colour`} value={c.hex} onChange={(e) => patchColor(m.id, c.id, { hex: e.target.value })} className="h-8 w-8 cursor-pointer rounded-full border border-line bg-transparent" />
                            <input aria-label={`${c.name} hex`} value={c.hex} onChange={(e) => patchColor(m.id, c.id, { hex: e.target.value })} className={cn(field, "w-24 font-mono")} />
                          </span>
                        </td>
                        <td className="py-2 pr-2">
                          <input aria-label="Colour name" value={c.name} onChange={(e) => patchColor(m.id, c.id, { name: e.target.value })} className={cn(field, "w-full")} maxLength={80} />
                        </td>
                        <td className="py-2 pr-2">
                          <select aria-label="Finish" value={c.finish} onChange={(e) => patchColor(m.id, c.id, { finish: e.target.value as ColorFinish })} className={field}>
                            {FINISHES.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            aria-label="Own price per gram in cents"
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="default"
                            value={c.pricePerGramCents ?? ""}
                            onChange={(e) => patchColor(m.id, c.id, { pricePerGramCents: e.target.value === "" ? undefined : Number(e.target.value) })}
                            className={cn(field, "w-24 font-mono")}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input type="checkbox" aria-label="In stock" checked={c.available} onChange={(e) => patchColor(m.id, c.id, { available: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
                        </td>
                        <td className="py-2 text-right">
                          <button type="button" onClick={() => patchMaterial(m.id, { colors: m.colors.filter((x) => x.id !== c.id) })} className="text-xs text-danger hover:underline">
                            Remove
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() =>
                patchMaterial(m.id, {
                  colors: [...m.colors, { id: slug(`new colour`, m.colors.map((c) => c.id)), name: "New colour", hex: "#888888", finish: "solid", available: true }],
                })
              }
              className="rounded-full border border-dashed border-line-strong px-4 py-1.5 text-sm text-muted hover:border-accent-line hover:text-fg"
            >
              + Add colour
            </button>
          </div>
        ))}

      <p className="text-xs text-faint">Untick &quot;In stock&quot; to hide a colour temporarily. Existing orders keep their colour name even if you remove it here.</p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save materials"}
        </Button>
        {state.message && <span className="text-sm text-success">{state.message}</span>}
        {state.error && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
