"use client";
import { motion, Reorder } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveDisplayAction } from "@/app/admin/display-actions";
import { Card } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { SLIDE_KINDS, type DisplaySettings, type SlideKind } from "@/lib/pos/types";

type Product = { id: string; name: string; image: string | null };

/** Admin > Display: pick and order the customer display's slides, choose the lamps that get one, and set the speed. */
export function DisplayEditor({ settings: saved, products }: { settings: DisplaySettings; products: Product[] }) {
  const router = useRouter();
  const [settings, setSettings] = useState(saved);
  const [saving, start] = useTransition();
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);
  const on = settings.slides;
  const off = SLIDE_KINDS.filter((k) => !on.includes(k.id));
  const info = (id: SlideKind) => SLIDE_KINDS.find((k) => k.id === id)!;

  const save = () =>
    start(async () => {
      const r = await saveDisplayAction(settings);
      toast(r.error ?? r.message ?? "Saved.", r.error ? "error" : "success");
      if (!r.error) router.refresh();
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Customer display</h1>
          <p className="text-sm text-muted">What the LightLab display shows between sales. It moves on by itself, and the stand picks up changes within five minutes.</p>
        </div>
        <div className="flex gap-2">
          <a href="/admin/display-preview" target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
            Preview full screen ↗
          </a>
          <motion.button type="button" whileTap={{ scale: 0.95 }} disabled={!dirty || saving} onClick={save} className={buttonClass("primary")}>
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </motion.button>
        </div>
      </div>
      {dirty && <p className="-mt-3 text-sm text-warning">Save first to see changes in the preview.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">Slides</h2>
          <p className="mt-1 text-sm text-muted">Drag to reorder. Switch off the ones you don&apos;t want.</p>
          <Reorder.Group axis="y" values={on} onReorder={(slides) => setSettings({ ...settings, slides })} className="mt-4 space-y-2">
            {on.map((id, i) => (
              <Reorder.Item key={id} value={id} className="flex cursor-grab items-center gap-3 rounded-2xl border border-line bg-surface p-3 active:cursor-grabbing">
                <span className="w-5 text-center text-sm font-semibold text-muted tabular-nums">{i + 1}</span>
                <span className="text-muted" aria-hidden>
                  ⠿
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{info(id).name}</span>
                  <span className="block truncate text-xs text-muted">{id === "lamps" ? `${settings.products.length} lamp${settings.products.length === 1 ? "" : "s"} picked` : info(id).hint}</span>
                </span>
                <button type="button" onClick={() => setSettings({ ...settings, slides: on.filter((x) => x !== id) })} className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:border-danger hover:text-danger">
                  Off
                </button>
              </Reorder.Item>
            ))}
          </Reorder.Group>
          {off.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Switched off</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {off.map((k) => (
                  <button key={k.id} type="button" onClick={() => setSettings({ ...settings, slides: [...on, k.id] })} className="rounded-full border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:border-accent-line hover:text-fg" title={k.hint}>
                    + {k.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="mt-6 block">
            <span className="flex justify-between text-sm font-medium">
              <span>Each slide stays up for</span>
              <span className="tabular-nums">{settings.seconds} seconds</span>
            </span>
            <input type="range" min={4} max={30} value={settings.seconds} onChange={(e) => setSettings({ ...settings, seconds: Number(e.target.value) })} className="mt-2 w-full accent-[var(--accent)]" />
          </label>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">Lamps on the display</h2>
          <p className="mt-1 text-sm text-muted">Each lamp you pick gets its own slide (photo, name and price), in the order you pick them. None show until you pick some{on.includes("lamps") ? "" : ", and the “Your picked lamps” slide is switched off"}.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {products.map((p) => {
              const n = settings.products.indexOf(p.id);
              const picked = n >= 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSettings({ ...settings, products: picked ? settings.products.filter((x) => x !== p.id) : [...settings.products, p.id] })}
                  className={cn("relative overflow-hidden rounded-2xl border-2 text-left transition-colors", picked ? "border-accent-line" : "border-line opacity-70 hover:opacity-100")}
                  aria-pressed={picked}
                >
                  <div className="aspect-square bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-xs text-muted">No photo</span>}
                  </div>
                  <p className="truncate px-2 py-1.5 text-sm font-medium">{p.name}</p>
                  {picked && <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-accent text-sm font-bold text-accent-ink">{n + 1}</span>}
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
