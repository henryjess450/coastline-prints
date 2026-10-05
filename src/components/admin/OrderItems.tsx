"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { hours, money } from "@/lib/format";
import { ItemPreview, type PreviewItem } from "./ItemPreview";

export type AdminItem = PreviewItem & {
  id: string;
  fileName: string;
  quantity: number;
  material: string;
  colorName: string;
  quality: string;
  infill: string;
  printerName: string;
  gramsEach: number;
  hoursEach: number;
  lineCents: number;
  rotated: boolean;
};

export function OrderItems({ items }: { items: AdminItem[] }) {
  const [selected, setSelected] = useState(items[0]?.id);
  const current = items.find((i) => i.id === selected) ?? items[0];
  return (
    <div className="space-y-3">
      {current && <ItemPreview item={current} />}
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id}>
            <div className={cn("rounded-2xl border p-4 transition-colors", it.id === current?.id ? "border-accent-line bg-accent-soft" : "border-line bg-surface")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button type="button" onClick={() => setSelected(it.id)} className="min-w-0 text-left" aria-pressed={it.id === current?.id}>
                  <p className="truncate font-semibold">
                    {it.fileName} <span className="font-normal text-faint">× {it.quantity}</span>
                  </p>
                  <p className="text-xs text-muted">Click to preview</p>
                </button>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm">{money(it.lineCents)}</span>
                  {!it.fileDeleted && (
                    <a href={`/api/admin/uploads/${it.uploadId}/file`} className="rounded-full border border-line px-3 py-1 text-xs font-medium hover:border-accent-line" download>
                      Download STL
                    </a>
                  )}
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                <Spec label="Size" value={`${it.size.x.toFixed(1)} × ${it.size.y.toFixed(1)} × ${it.size.z.toFixed(1)} mm`} />
                <Spec label="Scale" value={it.scale.x === it.scale.y && it.scale.y === it.scale.z ? `${(it.scale.x * 100).toFixed(1)}%` : "Custom"} />
                <Spec label="Material" value={`${it.material} · ${it.colorName}`} />
                <Spec label="Printer" value={it.printerName} />
                <Spec label="Quality / infill" value={`${it.quality} / ${it.infill}`} />
                <Spec label="Filament" value={`${(it.gramsEach * it.quantity).toFixed(1)} g total`} />
                <Spec label="Print time" value={`about ${hours(it.hoursEach * it.quantity)}`} />
                <Spec label="Orientation" value={it.rotated ? "Rotated to fit" : "As uploaded"} />
              </dl>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-faint">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
