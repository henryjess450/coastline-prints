"use client";
import { useEffect, useState } from "react";
import { labels, type LabelDesignId } from "@config/labels";
import { cn } from "@/lib/cn";

const DESIGN_KEY = "cp-label-design";
const NEXT_KEY = "cp-label-next-spot";
const PER_SHEET = labels.sheet.columns * labels.sheet.rows;

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

/**
 * Print label: pick a design and the free spot on the Avery 8168 sheet, then
 * open the PDF. One label per package, filling the next spots. Remembers the
 * design and where the sheet left off, so the next order starts on the next
 * free spot.
 */
export function LabelPrinter({ orderId, packages, returnSet }: { orderId: string; packages: number; returnSet: boolean }) {
  const [open, setOpen] = useState(false);
  const [design, setDesign] = useState<LabelDesignId>(labels.designs[0].id);
  const [start, setStart] = useState(1);

  useEffect(() => {
    const d = read(DESIGN_KEY);
    const s = Number(read(NEXT_KEY));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    if (labels.designs.some((x) => x.id === d)) setDesign(d as LabelDesignId);
    if (s >= 1 && s <= PER_SHEET) setStart(s);
  }, []);

  const used = Array.from({ length: packages }, (_, i) => start + i);
  const spills = used.some((n) => n > PER_SHEET);
  const href = `/api/admin/orders/${orderId}/label?design=${design}&start=${start}`;

  const made = () => {
    write(DESIGN_KEY, design);
    // Next free spot after this print; a full sheet starts over at 1.
    const after = ((start - 1 + packages) % PER_SHEET) + 1;
    write(NEXT_KEY, String(after));
  };

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-full border border-line px-4 py-2 text-sm font-medium transition-transform hover:-translate-y-px hover:border-accent-line active:scale-[0.97]">
        Print shipping label
      </button>
    );

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      {!returnSet && <p className="rounded-xl bg-danger/10 p-3 text-xs text-danger">Your return address isn&apos;t set. Add SHIP_FROM_ADDRESS to .env (lines split with |) and restart, or the label will say so where the address goes.</p>}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Design</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {labels.designs.map((d) => (
            <button key={d.id} type="button" onClick={() => setDesign(d.id)} aria-pressed={design === d.id} className={cn("rounded-xl border p-1.5 text-left transition-colors", design === d.id ? "border-accent bg-accent-soft" : "border-line hover:border-accent-line")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/admin/orders/${orderId}/label?design=${d.id}&preview=1`} alt="" loading="lazy" className="aspect-[7/10] w-full rounded-md border border-line bg-white object-cover" />
              <span className="mt-1 block text-xs font-semibold">{d.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Which spot on the sheet is free?</h3>
        <div className="flex items-start gap-4">
          <div className="grid w-28 shrink-0 grid-cols-2 gap-1.5 rounded-md border border-line bg-white p-2" role="radiogroup" aria-label="Starting spot on the Avery 8168 sheet">
            {Array.from({ length: PER_SHEET }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={start === n}
                onClick={() => setStart(n)}
                className={cn("grid aspect-[7/10] place-items-center rounded border text-sm font-bold transition-colors", used.includes(n) ? "border-[#0e4471] bg-[#0e4471] text-white" : n < start ? "border-dashed border-slate-300 bg-slate-100 text-slate-400" : "border-dashed border-slate-400 text-slate-500 hover:border-[#0e4471]")}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">
            {packages === 1 ? "1 label" : `${packages} labels, one per package`}, starting at spot {start}.
            {start > 1 && " Spots before it are treated as already used."}
            {spills && " It carries on to a second sheet."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a href={href} target="_blank" rel="noopener" onClick={made} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-ink transition-transform hover:-translate-y-px active:scale-[0.97]">
          Make PDF
        </a>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-fg">
          Close
        </button>
        <a href="/api/admin/labels/alignment" target="_blank" rel="noopener" className="ml-auto text-xs text-accent-text hover:underline">
          Alignment test
        </a>
      </div>
      <p className="text-xs text-faint">Print at 100% (Actual size), not Fit to page.</p>
    </div>
  );
}
