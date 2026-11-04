"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState, useTransition } from "react";
import { printPackingListAction, saveKitAction } from "@/app/lightlab/admin/markets/actions";
import { buttonClass } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { dayParts, hours } from "@/lib/shop/markets";
import type { PackingList } from "@/lib/shop/packing.server";

/** Ticks are kept on this device, per market day, so they survive a reload while packing. */
function useTicks(marketId: string) {
  const key = `pack:${marketId}`;
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading this device's saved ticks once
      setTicks(JSON.parse(localStorage.getItem(key) ?? "{}"));
    } catch {}
  }, [key]);
  const toggle = (id: string) =>
    setTicks((t) => {
      const next = { ...t, [id]: !t[id] };
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  const clear = () => {
    setTicks({});
    try {
      localStorage.removeItem(key);
    } catch {}
  };
  return { ticks, toggle, clear };
}

export function PackingChecklist({ list }: { list: PackingList }) {
  const { ticks, toggle, clear } = useTicks(list.market.id);
  const [printing, startPrint] = useTransition();
  const [editingKit, setEditingKit] = useState(false);
  const [kitText, setKitText] = useState(list.kit.join("\n"));
  const [saving, startSave] = useTransition();
  const d = dayParts(list.market.date);
  const lamps = list.lines.filter((l) => l.bring > 0);
  const skipped = list.lines.filter((l) => l.bring === 0);
  const all = [...list.pickups.map((o) => `o:${o.orderNumber}`), ...lamps.map((l) => `l:${l.key}`), ...list.kit.map((k) => `k:${k}`)];
  const done = all.filter((id) => ticks[id]).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/lightlab/admin/markets" className="text-sm text-muted hover:text-fg">
            ← Markets
          </Link>
          <h1 className="mt-1 font-display text-3xl font-bold">Packing list</h1>
          <p className="text-muted">
            {list.market.name} · {d.long}, {hours(list.market)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold tabular-nums">
            {done} of {all.length} packed
          </span>
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            disabled={printing}
            onClick={() =>
              startPrint(async () => {
                const r = await printPackingListAction(list.market.id);
                toast(r.error ?? r.message ?? "Sent.", r.error ? "error" : "success");
              })
            }
            className={buttonClass("primary")}
          >
            {printing ? "Sending…" : "Print on the receipt printer"}
          </motion.button>
          {done > 0 && (
            <button type="button" onClick={clear} className={buttonClass("secondary")}>
              Untick all
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Section title={`Orders to bring (${list.pickups.length})`} hint={list.pickups.length ? "Online orders picked up at this market." : "No online orders are being picked up here yet."}>
            {list.pickups.map((o) => (
              <Tick key={o.orderNumber} on={!!ticks[`o:${o.orderNumber}`]} onClick={() => toggle(`o:${o.orderNumber}`)}>
                <span className="font-semibold">
                  {o.orderNumber} · {o.name}
                </span>
                {o.ready && <span className="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">packed</span>}
                <span className="block text-sm text-muted">{o.items.join(", ")}</span>
                <Link href={`/admin/orders/${o.orderId}`} onClick={(e) => e.stopPropagation()} className="text-xs text-accent-text hover:underline">
                  Open order
                </Link>
              </Tick>
            ))}
          </Section>

          <Section
            title="Lamps"
            hint={
              list.lastDate
                ? `Half again what sold here last time (${dayParts(list.lastDate).long}, ${money(list.lastTotalCents)} in sales), at least 2, and no more than you have.`
                : "No sales here yet, so it suggests 3 of each lamp in stock and 1 of each made-to-order lamp to show."
            }
          >
            {lamps.map((l) => (
              <Tick key={l.key} on={!!ticks[`l:${l.key}`]} onClick={() => toggle(`l:${l.key}`)}>
                <span className="font-semibold">
                  {l.bring} × {l.name}
                </span>
                <span className="block text-sm text-muted">{[l.option, l.stock !== null ? `${l.stock} on hand` : "made to order, bring one to show", l.lastTime !== null ? `${l.lastTime} sold last time` : null].filter(Boolean).join(" · ")}</span>
              </Tick>
            ))}
            {skipped.length > 0 && <p className="text-xs text-faint">Out of stock: {skipped.map((l) => [l.name, l.option].filter(Boolean).join(" ")).join(", ")}</p>}
          </Section>
        </div>

        <Section
          title="Stand kit"
          hint="The same for every market."
          action={
            <button type="button" onClick={() => setEditingKit((e) => !e)} className="text-sm text-accent-text hover:underline">
              {editingKit ? "Cancel" : "Edit list"}
            </button>
          }
        >
          {editingKit ? (
            <div className="space-y-2">
              <textarea value={kitText} onChange={(e) => setKitText(e.target.value)} rows={14} className="w-full rounded-xl border border-line bg-elev p-3 text-sm outline-none focus:border-accent-line" />
              <p className="text-xs text-faint">One thing per line.</p>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  startSave(async () => {
                    const r = await saveKitAction(kitText);
                    toast(r.message ?? "Saved.");
                    setEditingKit(false);
                  })
                }
                className={buttonClass("primary", "sm")}
              >
                {saving ? "Saving…" : "Save kit list"}
              </button>
            </div>
          ) : (
            list.kit.map((k) => (
              <Tick key={k} on={!!ticks[`k:${k}`]} onClick={() => toggle(`k:${k}`)}>
                <span className="font-medium">{k}</span>
              </Tick>
            ))
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function Tick({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <div role="checkbox" aria-checked={on} tabIndex={0} onClick={onClick} onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), onClick())} className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors", on ? "border-success/40 bg-success/10" : "border-line hover:border-accent-line")}>
      <motion.span animate={{ scale: on ? [1, 0.85, 1.08, 1] : 1 }} transition={{ duration: 0.3 }} className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 text-sm font-bold", on ? "border-success bg-success text-white" : "border-line-strong")}>
        {on ? "✓" : ""}
      </motion.span>
      <div className={cn("min-w-0 flex-1", on && "opacity-60")}>{children}</div>
    </div>
  );
}
