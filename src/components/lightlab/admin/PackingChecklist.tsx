"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState, useTransition } from "react";
import { printPackingListAction, saveKitAction, setHoldStatusAction, setPackedAction } from "@/app/lightlab/admin/markets/actions";
import { clock } from "@/lib/shop/markets";
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

export type HoldRow = { id: string; label: string; quantity: number; name: string; email: string; phone: string; slotStart: string; slotEnd: string; status: string };

export function PackingChecklist({ list, holds = [] }: { list: PackingList; /** Free holds on lamps at the stand. */ holds?: HoldRow[] }) {
  const { ticks, toggle, clear: clearTicks } = useTicks(list.market.id);
  // Lamps are ticked on the server: what's packed shows on the shop as "At the stand" and can be reserved.
  const [packed, setPackedState] = useState<Record<string, number>>(list.packed);
  const pack = (key: string, count: number) => {
    setPackedState((p) => {
      const next = { ...p };
      if (count > 0) next[key] = count;
      else delete next[key];
      return next;
    });
    void setPackedAction(list.market.id, key, count).then((r) => r.error && toast(r.error, "error"));
  };
  const clear = () => {
    clearTicks();
    Object.keys(packed).forEach((k) => pack(k, 0));
  };
  const [printing, startPrint] = useTransition();
  const [editingKit, setEditingKit] = useState(false);
  const [kitText, setKitText] = useState(list.kit.join("\n"));
  const [saving, startSave] = useTransition();
  const d = dayParts(list.market.date);
  const lamps = list.lines.filter((l) => l.bring > 0);
  const skipped = list.lines.filter((l) => l.bring === 0);
  const all = [...list.pickups.map((o) => `o:${o.orderNumber}`), ...lamps.map((l) => `l:${l.key}`), ...list.kit.map((k) => `k:${k}`)];
  const done = all.filter((id) => (id.startsWith("l:") ? !!packed[id.slice(2)] : ticks[id])).length;

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
          <Holds holds={holds} />

          {/* Orders aren't brought to markets any more; this only shows for ones placed before. */}
          {list.pickups.length > 0 && (
          <Section title={`Orders to bring (${list.pickups.length})`} hint="Online orders placed before market pickup was turned off.">
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
          )}

          <Section
            title="Lamps"
            hint={
              list.lastDate
                ? `Half again what sold here last time (${dayParts(list.lastDate).long}, ${money(list.lastTotalCents)} in sales), at least 2, and no more than you have.`
                : "No sales here yet, so it suggests 3 of each lamp in stock and 1 of each made-to-order lamp to show."
            }
          >
            <p className="text-xs text-muted">Ticked lamps show on the shop as &ldquo;At {list.market.name}&rdquo; (the day before and on the day) and people can hold one for free (they pick a half hour to come by and pay at the stand).</p>
            {lamps.map((l) => {
              const n = packed[l.key] ?? 0;
              return (
                <Tick key={l.key} on={n > 0} onClick={() => pack(l.key, n > 0 ? 0 : l.bring)}>
                  <span className="font-semibold">
                    {n || l.bring} × {l.name}
                  </span>
                  <span className="block text-sm text-muted">{[l.option, l.stock !== null ? `${l.stock} on hand` : "made to order, bring one to show", l.lastTime !== null ? `${l.lastTime} sold last time` : null].filter(Boolean).join(" · ")}</span>
                  {n > 0 && (
                    <span className="mt-2 inline-flex items-center gap-2 text-sm" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <button type="button" aria-label="One fewer" onClick={() => pack(l.key, n - 1)} className="grid h-7 w-7 place-items-center rounded-full border border-line">
                        −
                      </button>
                      <span className="tabular-nums">{n} packed</span>
                      <button type="button" aria-label="One more" onClick={() => pack(l.key, n + 1)} className="grid h-7 w-7 place-items-center rounded-full border border-line">
                        +
                      </button>
                    </span>
                  )}
                </Tick>
              );
            })}
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

const HOLD_STATUS: Record<string, string> = { HELD: "Held", COLLECTED: "Picked up", RELEASED: "Released", CANCELLED: "They cancelled", EXPIRED: "Time's up" };

/** Free holds for this market: who's coming when. Mark picked up, or release one early. */
function Holds({ holds }: { holds: HoldRow[] }) {
  const [rows, setRows] = useState(holds);
  const set = (id: string, status: "COLLECTED" | "RELEASED" | "HELD") => {
    setRows((r) => r.map((h) => (h.id === id ? { ...h, status } : h)));
    void setHoldStatusAction(id, status).then((res) => res.error && toast(res.error, "error"));
  };
  const live = rows.filter((h) => h.status === "HELD").length;
  return (
    <Section title={`Holds (${live})`} hint={rows.length ? "People holding a lamp to pay for at the stand. Each one is back up for grabs once their half hour ends." : "No holds yet. People can hold lamps you tick below, and pay at the stand."}>
      {rows.map((h) => (
        <div key={h.id} className={cn("rounded-2xl border p-3", h.status === "HELD" ? "border-accent-line" : "border-line opacity-70")}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold tabular-nums">
              {clock(h.slotStart)}–{clock(h.slotEnd)} · {h.name}
            </span>
            <span className="text-xs font-semibold text-muted">{HOLD_STATUS[h.status] ?? h.status}</span>
          </div>
          <p className="text-sm">
            {h.quantity > 1 ? `${h.quantity} × ` : ""}
            {h.label}
          </p>
          <p className="text-xs text-muted">{[h.email, h.phone].filter(Boolean).join(" · ")}</p>
          {h.status === "HELD" && (
            <div className="mt-2 flex gap-3 text-sm">
              <button type="button" onClick={() => set(h.id, "COLLECTED")} className="font-semibold text-accent-text hover:underline">
                Picked up
              </button>
              <button type="button" onClick={() => confirm(`Release ${h.name}'s hold? The lamp goes back up for grabs.`) && set(h.id, "RELEASED")} className="text-muted hover:text-danger">
                Release
              </button>
            </div>
          )}
        </div>
      ))}
    </Section>
  );
}
