"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { fieldInput as input } from "@/components/admin/PrintFiles";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { dealPrice, type ShopProductDto } from "@/lib/shop/types";

/** A scanned price tag or shop link ("…/lightlab/mushroom-lamp") → its slug. */
const slugFrom = (s: string) => s.trim().match(/\/lightlab\/([a-z0-9-]+)/i)?.[1]?.toLowerCase() ?? null;

/**
 * "How much is this one?" without starting a sale: type a name or scan a
 * price tag, see the price and what's left of each option. The owner can
 * also make a lamp today's deal here (not in staff mode).
 */
export function PriceCheck({ products, staff, onAdd, onDeal }: { products: ShopProductDto[]; staff: boolean; onAdd: (p: ShopProductDto) => void; onDeal: (p: ShopProductDto, offCents: number | null) => Promise<string | null> }) {
  const [q, setQ] = useState("");
  const slug = slugFrom(q);
  const words = q.trim().toLowerCase();
  const found = slug ? products.filter((p) => p.slug === slug) : words ? products.filter((p) => `${p.name} ${p.category} ${p.slug}`.toLowerCase().includes(words)) : products;
  return (
    <div className="space-y-3">
      <input autoFocus className={input} placeholder="Type a lamp's name, or scan its price tag" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a lamp" />
      <ul className="max-h-[60dvh] space-y-2 overflow-y-auto">
        {found.map((p) => (
          <PriceRow key={p.id} p={p} staff={staff} onAdd={() => onAdd(p)} onDeal={(off) => onDeal(p, off)} />
        ))}
        {!found.length && <li className="py-8 text-center text-muted">Nothing matches &ldquo;{q.trim()}&rdquo;.</li>}
      </ul>
    </div>
  );
}

function PriceRow({ p, staff, onAdd, onDeal }: { p: ShopProductDto; staff: boolean; onAdd: () => void; onDeal: (offCents: number | null) => Promise<string | null> }) {
  const [editing, setEditing] = useState(false);
  const [off, setOff] = useState(p.standDealCents ? (p.standDealCents / 100).toString() : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prices = p.variants.length ? [...new Set(p.variants.map((v) => v.priceCents ?? p.priceCents))] : [p.priceCents];
  const stock = p.variants.length ? p.variants.map((v) => ({ name: v.name, left: v.stock ?? p.stock })) : [{ name: null, left: p.stock }];

  async function save(cents: number | null) {
    setBusy(true);
    setError(null);
    const err = await onDeal(cents);
    setBusy(false);
    if (err) return setError(err);
    setEditing(false);
  }

  return (
    <li className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.images[0] ? <img src={p.images[0]} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <span className="h-16 w-16 shrink-0 rounded-xl bg-elev" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate font-semibold">{p.name}</p>
            <p className="shrink-0 text-right">
              {p.standDealCents ? <span className="mr-2 text-sm text-faint line-through">{prices.map(money).join(" / ")}</span> : null}
              <span className="font-mono text-lg font-bold">{prices.map((c) => money(dealPrice(p, c))).join(" / ")}</span>
            </p>
          </div>
          {p.standDealCents ? <p className="text-sm font-semibold text-success">Today&apos;s deal: {money(p.standDealCents)} off</p> : null}
          <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted">
            {stock.map((s, i) => (
              <span key={i} className={cn(s.left != null && s.left <= 2 && "text-warning")}>
                {s.name ? `${s.name}: ` : ""}
                {s.left == null ? "made to order" : `${s.left} left`}
              </span>
            ))}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onAdd}>
          Add to sale
        </Button>
        {!staff &&
          (editing ? (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const cents = Math.round(Number(off.replace(/[$,\s]/g, "")) * 100);
                if (!cents || cents < 0) return setError("Type how many dollars off.");
                void save(cents);
              }}
            >
              <label className="flex items-center gap-1 text-sm">
                $
                <input autoFocus inputMode="decimal" className={cn(input, "h-9 w-20")} value={off} onChange={(e) => setOff(e.target.value)} aria-label="Dollars off today" />
                off today
              </label>
              <Button size="sm" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Make it today's deal"}
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                {p.standDealCents ? "Change deal" : "Today's deal…"}
              </Button>
              {p.standDealCents ? (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void save(null)}>
                  End deal
                </Button>
              ) : null}
            </>
          ))}
      </div>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </li>
  );
}
