"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { MANUAL_PAYMENTS, type ManualOrderInput, type ManualPayment } from "@/lib/orders/manual";
import type { ItemQuote } from "@/lib/pricing/quote";
import { needsVariant, unitPrice, type ShopProductDto } from "@/lib/shop/types";
import { shipping } from "@config/shipping";
import { Field, fieldInput as input, fieldSelect as select, PrintFiles, toCartItems, type FileLine, type Material, type Preset } from "./PrintFiles";

type Shop = { id: "coastline" | "lightlab"; name: string; products: ShopProductDto[] };

type ProductLine = { key: string; productId: string; variantId: string | null; quantity: number; customText: string };
type Quote = { totalCents: number; ok: boolean; lines: { label: string; cents: number | null; error?: string }[] } | null;

/** The admin's "New order" form: where it's from, what it is (files or shop products), who, how they get it, how they paid. */
export function NewOrderForm({ materials, qualities, infills, shops, sources }: { materials: Material[]; qualities: Preset[]; infills: Preset[]; shops: Shop[]; sources: string[] }) {
  const router = useRouter();
  const [attemptId] = useState(() => crypto.randomUUID());
  const [source, setSource] = useState("");
  const [kind, setKind] = useState<"file" | "shop">("file");
  const [files, setFiles] = useState<FileLine[]>([]);
  const [shopId, setShopId] = useState<Shop["id"]>(shops[0].id);
  const [lines, setLines] = useState<ProductLine[]>([]);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", notes: "" });
  const [method, setMethod] = useState<"pickup" | "ship">("pickup");
  const [pickup, setPickup] = useState({ date: "", time: "" });
  const [address, setAddress] = useState({ name: "", line1: "", line2: "", city: "", province: "BC", postal: "" });
  const [shippingDollars, setShippingDollars] = useState("");
  const [payment, setPayment] = useState<ManualPayment>("CASH");
  const [priceDollars, setPriceDollars] = useState("");
  const [emailCustomer, setEmailCustomer] = useState(false);
  const [printTicket, setPrintTicket] = useState(true);
  const [fetched, setQuote] = useState<Quote>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const shop = shops.find((s) => s.id === shopId)!;
  const productOf = (id: string) => shop.products.find((p) => p.id === id);

  const items = useMemo(() => toCartItems(files), [files]);
  const products = useMemo(() => lines.filter((l) => productOf(l.productId)).map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity, customText: l.customText || null })), [lines, shop]); // eslint-disable-line react-hooks/exhaustive-deps

  // Price it with the site's own quote, a moment after each change.
  useEffect(() => {
    const prints = kind === "file";
    if (prints ? !items.length : !products.length) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(prints ? "/api/quote" : "/api/shop/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prints ? { items } : { products }), signal: ctl.signal });
        const body = await res.json();
        if (!res.ok) return setQuote({ totalCents: 0, ok: false, lines: [{ label: "Price", cents: null, error: body.error ?? "Couldn't price it." }] });
        const q = body.quote as { totalCents: number; ok: boolean; items: ItemQuote[]; baseFeeCents: number; minimumAdjCents: number };
        const named = prints ? files.map((f) => f.upload.name) : products.map((p) => productOf(p.productId)?.name ?? "Product");
        setQuote({
          totalCents: q.totalCents,
          ok: q.ok,
          lines: [
            ...q.items.map((it, i) => ({ label: named[i], cents: it.ok ? it.lineCents : null, error: it.ok ? undefined : it.error })),
            ...(q.baseFeeCents ? [{ label: "Order fee", cents: q.baseFeeCents }] : []),
            ...(q.minimumAdjCents ? [{ label: "Minimum top-up", cents: q.minimumAdjCents }] : []),
          ],
        });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setQuote({ totalCents: 0, ok: false, lines: [{ label: "Price", cents: null, error: "Couldn't reach the server." }] });
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [kind, items, products]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLine = (key: string, patch: Partial<ProductLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const hasItems = kind === "file" ? files.length > 0 : products.length > 0;
  const quote = hasItems ? fetched : null;
  const dollarsToCents = (v: string) => (v.trim() === "" ? null : Math.round(Number(v.replace(/[$,\s]/g, "")) * 100));
  const shippingCents = method === "ship" ? (dollarsToCents(shippingDollars) ?? 0) : 0;
  const priceCents = dollarsToCents(priceDollars);
  const itemsCents = quote?.ok ? (priceCents != null && !Number.isNaN(priceCents) ? priceCents : quote.totalCents) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (priceCents != null && (Number.isNaN(priceCents) || priceCents < 0)) return setError("The price isn't a number.");
    if (Number.isNaN(shippingCents)) return setError("The shipping amount isn't a number.");
    const body: ManualOrderInput = {
      attemptId,
      source,
      customer,
      fulfillment: method === "pickup" ? { method, ...pickup } : { method, address, shippingCents },
      items: kind === "file" ? items : [],
      products: kind === "shop" ? products : [],
      payment,
      priceCents: priceCents != null && quote?.ok && priceCents !== quote.totalCents ? priceCents : null,
      emailCustomer: emailCustomer && !!customer.email.trim(),
      printTicket,
    };
    setSaving(true);
    try {
      const res = await fetch("/api/admin/orders/new", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error ?? "Couldn't save the order.");
      router.push(`/admin/orders/${out.orderId}`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Step n={1} title="Where's it from?">
        <input className={input} value={source} onChange={(e) => setSource(e.target.value)} placeholder="Facebook Marketplace, LightLab stall..." maxLength={60} required aria-label="Where the order came from" />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sources.slice(0, 12).map((s) => (
            <button key={s} type="button" onClick={() => setSource(s)} className={cn("rounded-full border px-3 py-1 text-sm transition-colors", source === s ? "border-accent-line bg-accent text-accent-ink" : "border-line text-muted hover:text-fg")}>
              {s}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-faint">Shows up on the Sources page next to Google, Instagram and the rest.</p>
      </Step>

      <Step n={2} title="What are they getting?">
        <Segmented
          label="Order type"
          value={kind}
          onChange={setKind}
          options={[
            { value: "file", label: "Upload a file" },
            { value: "shop", label: "From the shop" },
          ]}
        />
        {kind === "file" ? (
          <div className="mt-4">
            <PrintFiles files={files} onChange={setFiles} options={{ materials, qualities, infills }} onError={setError} />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex gap-1.5">
              {shops.map((s) => (
                <button key={s.id} type="button" onClick={() => { setShopId(s.id); setLines([]); }} className={cn("rounded-full border px-3 py-1 text-sm", shopId === s.id ? "border-accent-line bg-accent-soft text-fg" : "border-line text-muted hover:text-fg")}>
                  {s.name}
                </button>
              ))}
            </div>
            {lines.map((l) => {
              const p = productOf(l.productId);
              if (!p) return null;
              return (
                <div key={l.key} className="rounded-2xl border border-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{p.name}</p>
                    <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="text-sm text-muted hover:text-danger">
                      Remove
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {needsVariant(p) && (
                      <Field label="Option">
                        <select className={select} value={l.variantId ?? ""} onChange={(e) => setLine(l.key, { variantId: e.target.value })}>
                          {p.variants.map((v) => <option key={v.id} value={v.id}>{v.name} · {money(unitPrice(p, v.id))}{v.stock != null ? ` (${v.stock} left)` : ""}</option>)}
                        </select>
                      </Field>
                    )}
                    <Field label="How many">
                      <input className={input} type="number" min={1} max={20} value={l.quantity} onChange={(e) => setLine(l.key, { quantity: Math.min(20, Math.max(1, Math.floor(Number(e.target.value)) || 1)) })} />
                    </Field>
                    {p.personalize && (
                      <Field label={p.personalize}>
                        <input className={input} value={l.customText} maxLength={24} onChange={(e) => setLine(l.key, { customText: e.target.value })} />
                      </Field>
                    )}
                  </div>
                </div>
              );
            })}
            {shop.products.length ? (
              <select
                className={select}
                value=""
                aria-label="Add a product"
                onChange={(e) => {
                  const p = productOf(e.target.value);
                  if (p) setLines((ls) => [...ls, { key: crypto.randomUUID(), productId: p.id, variantId: needsVariant(p) ? p.variants[0].id : null, quantity: 1, customText: "" }]);
                }}
              >
                <option value="">+ Add a product</option>
                {shop.products.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.priceCents)}{p.stock != null ? ` (${p.stock} left)` : ""}</option>)}
              </select>
            ) : (
              <p className="text-sm text-muted">No products in this shop yet.</p>
            )}
          </div>
        )}
      </Step>

      <Step n={3} title="Who's it for?">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Name">
            <input className={input} value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} required minLength={2} />
          </Field>
          <Field label="Phone (optional)">
            <input className={input} type="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
          </Field>
          <Field label="Email (optional)" wide>
            <input className={input} type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
          </Field>
          <Field label="Notes (optional)" wide>
            <textarea className="min-h-20 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-accent-line" value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} maxLength={1000} placeholder="Their Marketplace name, what they asked for..." />
          </Field>
        </div>
      </Step>

      <Step n={4} title="How do they get it?">
        <Segmented label="Pickup or ship" value={method} onChange={setMethod} options={[{ value: "pickup", label: "Pickup / hand over" }, { value: "ship", label: "Ship it" }]} />
        {method === "pickup" ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Field label="Pickup day (optional)">
              <input className={input} type="date" value={pickup.date} onChange={(e) => setPickup({ ...pickup, date: e.target.value })} />
            </Field>
            <Field label="Time (optional)">
              <input className={input} type="time" step={900} value={pickup.time} onChange={(e) => setPickup({ ...pickup, time: e.target.value })} disabled={!pickup.date} />
            </Field>
          </div>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Field label="Ship to (name)" wide>
              <input className={input} value={address.name} onChange={(e) => setAddress({ ...address, name: e.target.value })} placeholder={customer.name} required />
            </Field>
            <Field label="Street address">
              <input className={input} value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} required />
            </Field>
            <Field label="Apt, unit (optional)">
              <input className={input} value={address.line2} onChange={(e) => setAddress({ ...address, line2: e.target.value })} />
            </Field>
            <Field label="City">
              <input className={input} value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} required />
            </Field>
            <Field label="Province">
              <select className={select} value={address.province} onChange={(e) => setAddress({ ...address, province: e.target.value })}>
                {shipping.provinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Postal code">
              <input className={input} value={address.postal} onChange={(e) => setAddress({ ...address, postal: e.target.value })} required />
            </Field>
            <Field label="Shipping charged ($)">
              <input className={input} inputMode="decimal" value={shippingDollars} onChange={(e) => setShippingDollars(e.target.value)} placeholder="0.00" />
            </Field>
          </div>
        )}
      </Step>

      <Step n={5} title="Price and payment">
        <div className="space-y-1 text-sm">
          {!hasItems && <p className="text-muted">Add a file or a product to see the price.</p>}
          {hasItems && !quote && <p className="animate-pulse text-muted">Pricing...</p>}
          {quote?.lines.map((l, i) => (
            <div key={i} className="flex justify-between gap-3">
              <span className={cn("truncate", l.error ? "text-danger" : "text-muted")}>{l.error ? `${l.label}: ${l.error}` : l.label}</span>
              {l.cents != null && <span className="font-mono">{money(l.cents)}</span>}
            </div>
          ))}
          {quote?.ok && (
            <div className="flex justify-between border-t border-line pt-1 font-semibold">
              <span>Site price</span>
              <span className="font-mono">{money(quote.totalCents)}</span>
            </div>
          )}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Field label="Charge instead ($, optional)">
            <input className={input} inputMode="decimal" value={priceDollars} onChange={(e) => setPriceDollars(e.target.value)} placeholder={quote?.ok ? (quote.totalCents / 100).toFixed(2) : ""} />
          </Field>
          <Field label="How they paid">
            <select className={select} value={payment} onChange={(e) => setPayment(e.target.value as ManualPayment)}>
              {MANUAL_PAYMENTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </Field>
        </div>
        <p className="mt-1 text-xs text-faint">Less than the site price shows as a price adjustment on the receipt. It can&apos;t be more.</p>
        {itemsCents != null && (
          <p className="mt-4 flex justify-between text-lg font-semibold">
            <span>{payment === "UNPAID" ? "To collect" : "Total"}</span>
            <span className="font-mono">{money(itemsCents + (Number.isNaN(shippingCents) ? 0 : shippingCents))}</span>
          </p>
        )}
        <div className="mt-4 space-y-1.5 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={printTicket} onChange={(e) => setPrintTicket(e.target.checked)} /> Print the order ticket
          </label>
          <label className={cn("flex items-center gap-2", !customer.email.trim() && "text-faint")}>
            <input type="checkbox" checked={emailCustomer && !!customer.email.trim()} disabled={!customer.email.trim()} onChange={(e) => setEmailCustomer(e.target.checked)} /> Email the customer a receipt {!customer.email.trim() && "(needs an email)"}
          </label>
        </div>
      </Step>

      {error && <p role="alert" className="rounded-2xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={saving || !hasItems || !quote?.ok || !source.trim()}>
          {saving ? "Saving..." : "Create order"}
        </Button>
      </div>
    </form>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-sm text-accent-ink">{n}</span>
        {title}
      </h2>
      {children}
    </Card>
  );
}

