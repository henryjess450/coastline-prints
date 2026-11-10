"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { closeCommissionAction, quoteCommissionAction } from "@/app/lightlab/admin/commissions/actions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";

export type AdminCommission = { id: string; token: string; status: string; name: string; email: string; phone: string; idea: string; shade: string; shadeHex: string | null; neededBy: string; photos: string[]; quoteCents: number | null; quoteNote: string; createdAt: string; orderId: string | null; orderNumber: string | null };

const FILTERS = [
  { id: "todo", label: "Needs a quote", match: ["NEW"] },
  { id: "waiting", label: "Waiting on them", match: ["QUOTED", "ACCEPTED"] },
  { id: "paid", label: "Paid", match: ["PAID"] },
  { id: "closed", label: "Closed", match: ["DECLINED", "CLOSED"] },
] as const;

const STATUS: Record<string, string> = { NEW: "Needs a quote", QUOTED: "Quote sent", ACCEPTED: "Accepted, waiting for payment", PAID: "Paid", DECLINED: "They said no", CLOSED: "Closed" };

const input = "w-full rounded-xl border border-line bg-elev px-3 text-sm outline-none focus:border-accent-line";

/** LightLab admin: "Make me a lamp" requests. Quote them; they become orders once paid. */
export function CommissionsAdmin({ list }: { list: AdminCommission[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>(list.some((c) => c.status === "NEW") ? "todo" : "waiting");
  const shown = list.filter((c) => (FILTERS.find((f) => f.id === filter)!.match as readonly string[]).includes(c.status));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Commissions</h1>
        <p className="mt-1 text-sm text-muted">
          Requests from{" "}
          <Link href="/lightlab/commission" target="_blank" className="text-accent-text underline underline-offset-4">
            Make me a lamp
          </Link>
          . Send a quote; once they accept and pay (e-Transfer or card) it shows up as a LightLab order.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const n = list.filter((c) => (f.match as readonly string[]).includes(c.status)).length;
          return (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={cn("rounded-full border px-4 py-1.5 text-sm font-medium", filter === f.id ? "border-transparent bg-accent text-accent-ink" : "border-line text-muted hover:text-fg")}>
              {f.label} {n > 0 && <span className="ml-1 font-mono text-xs">{n}</span>}
            </button>
          );
        })}
      </div>
      {!shown.length && <p className="rounded-3xl border border-dashed border-line-strong p-10 text-center text-muted">Nothing here.</p>}
      <ul className="space-y-4">
        {shown.map((c) => (
          <Row key={c.id} c={c} />
        ))}
      </ul>
    </div>
  );
}

function Row({ c }: { c: AdminCommission }) {
  const [price, setPrice] = useState(c.quoteCents != null ? (c.quoteCents / 100).toFixed(2) : "");
  const [note, setNote] = useState(c.quoteNote);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const canQuote = c.status === "NEW" || c.status === "QUOTED" || c.status === "ACCEPTED" || c.status === "DECLINED";

  return (
    <li id={c.id} className="scroll-mt-24 rounded-3xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold">{c.name}</p>
          <p className="text-sm text-muted">
            <a href={`mailto:${c.email}`} className="hover:text-fg">
              {c.email}
            </a>
            {c.phone && ` · ${c.phone}`} · {new Date(c.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
          </p>
        </div>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold">{STATUS[c.status] ?? c.status}</span>
      </div>
      <p className="mt-4 whitespace-pre-line leading-relaxed">{c.idea}</p>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        {c.shadeHex && <span className="h-4 w-4 rounded-full border border-line-strong" style={{ background: c.shadeHex }} />}
        Shade: {c.shade || "help them choose"}
        {c.neededBy && <span>· Wants it by {c.neededBy}</span>}
      </p>
      {c.photos.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {c.photos.map((src, i) => (
            <a key={src} href={src} target="_blank" rel="noreferrer" className="block h-24 w-24 overflow-hidden rounded-2xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
            </a>
          ))}
        </div>
      )}

      {c.status === "PAID" ? (
        <p className="mt-5 text-sm">
          Paid {c.quoteCents != null && money(c.quoteCents)}.{" "}
          {c.orderId && (
            <Link href={`/admin/orders/${c.orderId}`} className="text-accent-text underline underline-offset-4">
              Order {c.orderNumber}
            </Link>
          )}
        </p>
      ) : (
        canQuote && (
          <div className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Price ($)</span>
              <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="85" className={cn(input, "h-11 font-mono")} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Note with the quote (what&apos;s included, how long it takes)</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} placeholder="About 30 cm tall in Peach with a warm LED bulb and switch. Ready about 2 weeks after you pay." className={cn(input, "py-2")} />
            </label>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <Button
                disabled={pending || !price}
                onClick={() =>
                  start(async () => {
                    const r = await quoteCommissionAction(c.id, price, note);
                    setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Quote sent. They got an email with a link to say yes and pay." });
                  })
                }
              >
                {c.status === "NEW" ? "Send quote" : "Send new quote"}
              </Button>
              <a href={`/lightlab/commission/${c.token}`} target="_blank" rel="noreferrer" className="text-sm text-muted underline underline-offset-4 hover:text-fg">
                Their page
              </a>
              <button type="button" disabled={pending} onClick={() => confirm("Close this request? Their quote and payment links stop working.") && start(async () => void (await closeCommissionAction(c.id)))} className="ml-auto text-sm text-muted underline-offset-4 hover:text-danger hover:underline">
                Close
              </button>
            </div>
            {c.status === "ACCEPTED" && <p className="text-sm text-muted sm:col-span-2">They accepted {c.quoteCents != null && money(c.quoteCents)}. A new quote replaces it and their payment code and link stop working.</p>}
            {msg && <p className={cn("text-sm sm:col-span-2", msg.ok ? "text-success" : "text-danger")}>{msg.text}</p>}
          </div>
        )
      )}
    </li>
  );
}
