"use client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Field, fieldInput as input, fieldSelect as select, PrintFiles, toCartItems, type FileLine, type PrintOptions } from "@/components/admin/PrintFiles";
import { bounce, Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { POS_BRANDS, POS_PAYMENTS, type CustomLine, type PosBrand, type PosCartInput, type PosPayment, type PosQuote, type PosSaleInput, type PosScreen } from "@/lib/pos/types";
import { needsVariant, unitPrice, type ShopProductDto } from "@/lib/shop/types";
import { CustomerScreen } from "./CustomerScreen";

type ProductLine = { key: string; productId: string; variantId: string | null; quantity: number; customText: string };
type Stage = "cart" | "email" | "pay";
type Done = { orderId: string; orderNumber: string; changeCents: number | null; emailed: boolean; screen: PosScreen };

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(`pos:${k}`);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v == null) localStorage.removeItem(`pos:${k}`);
      else localStorage.setItem(`pos:${k}`, v);
    } catch {}
  },
};

const dollars = (v: string) => (v.trim() === "" ? null : Math.round(Number(v.replace(/[$,\s]/g, "")) * 100));

/**
 * The cashier side of the register. Ring up shop products, custom amounts
 * and uploaded prints; the customer follows along on a paired display (or
 * this iPad turned around) and can type their email. Payment is taken at the
 * counter and recorded; "Complete sale" makes the order.
 */
export function Register({ products, printOptions }: { products: Record<PosBrand, ShopProductDto[]>; printOptions: PrintOptions }) {
  const [brand, setBrandState] = useState<PosBrand>("lightlab");
  const [source, setSource] = useState<string>(POS_BRANDS[0].source);
  const [registerId, setRegisterId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [flip, setFlip] = useState(false);

  const [lines, setLines] = useState<ProductLine[]>([]);
  const [custom, setCustom] = useState<(CustomLine & { key: string })[]>([]);
  const [files, setFiles] = useState<FileLine[]>([]);
  const [codes, setCodes] = useState<string[]>([]);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", notes: "" });
  const [stage, setStage] = useState<Stage>("cart");
  const [payment, setPayment] = useState<PosPayment>("CASH");
  const [tendered, setTendered] = useState("");
  const [opts, setOpts] = useState({ handedOver: true, printTicket: false, emailCustomer: true });
  const [quote, setQuote] = useState<PosQuote | null>(null);
  const [attemptId, setAttemptId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const totalRef = useRef<HTMLSpanElement>(null);

  // Remember the brand, its source and the paired display on this device.
  useEffect(() => {
    const b = store.get("brand") === "coastline" ? "coastline" : "lightlab";
    /* eslint-disable react-hooks/set-state-in-effect -- reading this device's saved settings once */
    setBrandState(b);
    setSource(store.get(`source:${b}`) ?? POS_BRANDS.find((x) => x.id === b)!.source);
    setRegisterId(store.get("register"));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const shopProducts = products[brand];
  const productOf = useCallback((id: string) => shopProducts.find((p) => p.id === id), [shopProducts]);
  const hasPrints = files.length > 0;

  function setBrand(b: PosBrand) {
    if (b === brand) return;
    store.set("brand", b);
    setBrandState(b);
    setSource(store.get(`source:${b}`) ?? POS_BRANDS.find((x) => x.id === b)!.source);
    // The other shop's products and prints don't carry over.
    setLines([]);
    if (b === "lightlab") setFiles([]);
  }

  const cart: PosCartInput = useMemo(
    () => ({
      brand,
      items: toCartItems(files),
      products: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity, customText: l.customText || null })),
      custom: custom.map(({ name, unitCents, quantity }) => ({ name, unitCents, quantity })),
      codes,
      email: customer.email.trim(),
    }),
    [brand, files, lines, custom, codes, customer.email],
  );
  const empty = !files.length && !lines.length && !custom.length;

  // Server price, a moment after each change.
  useEffect(() => {
    if (empty) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/pos/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cart), signal: ctl.signal });
        const body = await res.json();
        setQuote(res.ok ? body : { ok: false, error: body.error ?? "Couldn't price the cart.", lines: [], fees: [], discounts: [], rejected: [], totalCents: 0 });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setQuote({ ok: false, error: "Can't reach the server.", lines: [], fees: [], discounts: [], rejected: [], totalCents: 0 });
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [cart, empty]);
  const shownQuote = empty ? null : quote;

  useEffect(() => bounce(totalRef.current), [shownQuote?.totalCents]);

  const tenderedCents = payment === "CASH" ? dollars(tendered) : null;

  // What the customer sees.
  const screen: PosScreen = useMemo(() => {
    if (done) return done.screen;
    if (empty || !shownQuote) return { stage: "idle", brand };
    return { stage, brand, lines: shownQuote.lines, fees: shownQuote.fees, discounts: shownQuote.discounts, totalCents: shownQuote.totalCents, payment, tenderedCents: tenderedCents != null && !Number.isNaN(tenderedCents) ? tenderedCents : null, email: customer.email || undefined };
  }, [done, empty, shownQuote, stage, brand, payment, tenderedCents, customer.email]);

  // Push it to the paired display (a little debounced, so typing doesn't flood it).
  const lastPushed = useRef("");
  const clearEmailNext = useRef(false);
  useEffect(() => {
    if (!registerId) return;
    const json = JSON.stringify(screen);
    if (json === lastPushed.current) return;
    const t = setTimeout(async () => {
      const clearEmail = clearEmailNext.current;
      clearEmailNext.current = false;
      const res = await fetch(`/api/admin/pos/registers/${registerId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ screen, clearEmail }) }).catch(() => null);
      if (res?.status === 404) unpair(false);
      else if (res?.ok) lastPushed.current = json;
    }, 150);
    return () => clearTimeout(t);
  }, [screen, registerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pick up the email the customer types on the display.
  const seenEmail = useRef<string | null>(null);
  useEffect(() => {
    if (!registerId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`/api/admin/pos/registers/${registerId}`, { cache: "no-store" });
        if (res.status === 404) return unpair(false);
        const body = (await res.json()) as { customerEmail: string | null; online: boolean };
        setOnline(body.online);
        if (body.customerEmail != null && body.customerEmail !== seenEmail.current) {
          seenEmail.current = body.customerEmail;
          if (body.customerEmail) setCustomer((c) => ({ ...c, email: body.customerEmail! }));
          setStage((s) => (s === "email" ? "cart" : s));
        }
        if (body.customerEmail == null) seenEmail.current = null;
      } catch {
        setOnline(false);
      }
      if (!stopped) timer = setTimeout(tick, 1500);
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [registerId]); // eslint-disable-line react-hooks/exhaustive-deps

  function unpair(tellServer = true) {
    if (tellServer && registerId) fetch(`/api/admin/pos/registers/${registerId}`, { method: "DELETE" }).catch(() => undefined);
    store.set("register", null);
    setRegisterId(null);
    lastPushed.current = "";
  }

  function addProduct(p: ShopProductDto) {
    setDone(null);
    // Options or personalised: always its own line to fill in. Plain: bump the count.
    if (needsVariant(p) || p.personalize) {
      setLines((ls) => [...ls, { key: crypto.randomUUID(), productId: p.id, variantId: needsVariant(p) ? p.variants[0].id : null, quantity: 1, customText: "" }]);
      return;
    }
    setLines((ls) => (ls.some((l) => l.productId === p.id) ? ls.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l)) : [...ls, { key: crypto.randomUUID(), productId: p.id, variantId: null, quantity: 1, customText: "" }]));
  }

  function newSale() {
    setLines([]);
    setCustom([]);
    setFiles([]);
    setCodes([]);
    setCustomer({ name: "", email: "", phone: "", notes: "" });
    setStage("cart");
    setPayment("CASH");
    setTendered("");
    setOpts({ handedOver: true, printTicket: false, emailCustomer: true });
    setQuote(null);
    setError(null);
    setDone(null);
    setFlip(false);
    setAttemptId(crypto.randomUUID());
    seenEmail.current = null;
    clearEmailNext.current = true;
  }

  // Prints still need printing: default to not handed over, with a ticket.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follows whether the cart has prints
    setOpts((o) => ({ ...o, handedOver: !hasPrints, printTicket: hasPrints }));
  }, [hasPrints]);

  async function completeSale() {
    if (!shownQuote?.ok) return;
    setError(null);
    if (tenderedCents != null && (Number.isNaN(tenderedCents) || tenderedCents < shownQuote.totalCents)) return setError("That's less cash than the total.");
    setSaving(true);
    store.set(`source:${brand}`, source);
    const body: PosSaleInput = {
      attemptId,
      cart,
      expectedTotalCents: shownQuote.totalCents,
      payment,
      tenderedCents,
      source,
      customer,
      ...opts,
      emailCustomer: opts.emailCustomer && !!customer.email.trim(),
      registerId: flip ? null : registerId,
    };
    try {
      const res = await fetch("/api/admin/pos/sale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = await res.json();
      if (!res.ok) {
        if (out.quote) setQuote(out.quote);
        throw new Error(out.error ?? "Couldn't ring up the sale.");
      }
      const thanks: PosScreen = { stage: "done", brand, lines: shownQuote.lines, fees: shownQuote.fees, discounts: shownQuote.discounts, totalCents: shownQuote.totalCents, payment, tenderedCents, orderNumber: out.orderNumber, emailed: out.emailed };
      lastPushed.current = JSON.stringify(thanks); // the server already showed it on the display
      setDone({ orderId: out.orderId, orderNumber: out.orderNumber, changeCents: out.changeCents, emailed: out.emailed, screen: thanks });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const flipEmail = async (email: string) => {
    if (email) setCustomer((c) => ({ ...c, email }));
    setStage("cart");
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold">Register</h1>
          <div className="w-64">
            <Segmented label="Selling as" value={brand} onChange={setBrand} options={POS_BRANDS.map((b) => ({ value: b.id, label: b.name }))} />
          </div>
        </div>
        <DisplayControl registerId={registerId} online={online} onPaired={(id) => { store.set("register", id); setRegisterId(id); lastPushed.current = ""; }} onUnpair={() => unpair()} onFlip={() => setFlip(true)} />
      </div>

      {done ? (
        <SaleDone done={done} payment={payment} onNew={newSale} onShowThanks={() => setFlip(true)} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
          <div className="space-y-4">
            <Card className="p-4">
              <h2 className="mb-3 font-display text-lg font-semibold">Products</h2>
              {shopProducts.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {shopProducts.map((p) => {
                    const left = p.variants.some((v) => v.stock != null) ? null : p.stock;
                    return (
                      <motion.button key={p.id} type="button" whileTap={{ scale: 0.95 }} onClick={() => addProduct(p)} disabled={left === 0} className="group overflow-hidden rounded-2xl border border-line bg-surface text-left transition-colors hover:border-accent-line disabled:opacity-40">
                        <div className="aspect-[4/3] bg-surface-strong">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.images[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" />}
                        </div>
                        <div className="p-2.5">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-muted">
                            {money(p.priceCents)}
                            {left != null && ` · ${left} left`}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted">No {brand === "lightlab" ? "LightLab" : "Coastline shop"} products yet.</p>
              )}
            </Card>

            <CustomAdder onAdd={(c) => { setDone(null); setCustom((l) => [...l, { ...c, key: crypto.randomUUID() }]); }} />

            {brand === "coastline" && (
              <Card className="p-4">
                <h2 className="mb-3 font-display text-lg font-semibold">Custom print from a file</h2>
                <PrintFiles files={files} onChange={setFiles} options={printOptions} onError={setError} />
              </Card>
            )}
          </div>

          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Card className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Sale</h2>
                {!empty && (
                  <button type="button" onClick={newSale} className="text-sm text-muted hover:text-danger">
                    Clear
                  </button>
                )}
              </div>
              {empty ? (
                <p className="py-6 text-center text-sm text-muted">Tap a product or add a custom item.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  <AnimatePresence initial={false}>
                    {files.map((f, i) => (
                      <CartRow key={f.key} name={f.upload.name} detail="Custom print" quantity={f.quantity} cents={shownQuote?.lines.find((l) => l.key === `print-${i}`)?.cents} onQty={(q) => setFiles((fs) => fs.map((x) => (x.key === f.key ? { ...x, quantity: q } : x)))} onRemove={() => setFiles((fs) => fs.filter((x) => x.key !== f.key))} />
                    ))}
                    {lines.map((l, i) => {
                      const p = productOf(l.productId);
                      if (!p) return null;
                      return (
                        <CartRow key={l.key} name={p.name} quantity={l.quantity} cents={shownQuote?.lines.find((x) => x.key === `product-${i}`)?.cents} onQty={(q) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, quantity: q } : x)))} onRemove={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                          {needsVariant(p) && (
                            <select className={cn(select, "mt-1 h-9")} value={l.variantId ?? ""} onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, variantId: e.target.value } : x)))}>
                              {p.variants.map((v) => (
                                <option key={v.id} value={v.id} disabled={v.stock === 0}>
                                  {v.name} · {money(unitPrice(p, v.id))}
                                  {v.stock != null ? ` (${v.stock} left)` : ""}
                                </option>
                              ))}
                            </select>
                          )}
                          {p.personalize && <input className={cn(input, "mt-1 h-9")} placeholder={p.personalize} maxLength={24} value={l.customText} onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, customText: e.target.value } : x)))} />}
                        </CartRow>
                      );
                    })}
                    {custom.map((c) => (
                      <CartRow key={c.key} name={c.name} detail="Custom item" quantity={c.quantity} cents={c.unitCents * c.quantity} onQty={(q) => setCustom((cs) => cs.map((x) => (x.key === c.key ? { ...x, quantity: q } : x)))} onRemove={() => setCustom((cs) => cs.filter((x) => x.key !== c.key))} />
                    ))}
                  </AnimatePresence>
                </ul>
              )}

              {shownQuote && (
                <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                  {shownQuote.fees.map((f) => (
                    <Row key={f.label} label={f.label} value={money(f.cents)} />
                  ))}
                  {shownQuote.discounts.map((d) => (
                    <Row key={d.label} label={d.label} value={`−${money(d.cents)}`} />
                  ))}
                  {shownQuote.error && <p className="text-danger">{shownQuote.error}</p>}
                  <div className="flex items-baseline justify-between pt-1">
                    <dt className="font-semibold">Total</dt>
                    <dd>
                      <span ref={totalRef} className="inline-block font-display text-3xl font-bold tabular-nums">
                        {money(shownQuote.totalCents)}
                      </span>
                    </dd>
                  </div>
                </dl>
              )}
              <CodeAdder codes={codes} rejected={shownQuote?.rejected ?? []} onChange={setCodes} />
            </Card>

            {!empty && (
              <Card className="space-y-3 p-4">
                <h2 className="font-display text-lg font-semibold">Customer</h2>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Name (optional)">
                    <input className={input} value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
                  </Field>
                  <Field label="Phone (optional)">
                    <input className={input} type="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
                  </Field>
                  <Field label="Email (optional)" wide>
                    <div className="flex gap-2">
                      <input className={input} type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
                      <Button
                        variant="secondary"
                        className="shrink-0"
                        disabled={stage === "email"}
                        onClick={() => {
                          setStage("email");
                          if (!registerId) setFlip(true);
                        }}
                      >
                        {stage === "email" ? "Asking..." : "Ask them"}
                      </Button>
                    </div>
                  </Field>
                  <Field label="Where's it from?" wide>
                    <input className={input} value={source} maxLength={60} onChange={(e) => setSource(e.target.value)} />
                  </Field>
                </div>
              </Card>
            )}

            {!empty && (
              <Card className="space-y-3 p-4">
                <h2 className="font-display text-lg font-semibold">Payment</h2>
                <Segmented label="Payment" value={payment} onChange={(p) => { setPayment(p); setStage("pay"); }} options={POS_PAYMENTS.map((p) => ({ value: p.id, label: p.label }))} />
                {payment === "CASH" && shownQuote?.ok && <CashTender totalCents={shownQuote.totalCents} value={tendered} onChange={(v) => { setTendered(v); setStage("pay"); }} />}
                {payment === "CARD" && <p className="text-sm text-muted">Take the card on your reader, then complete the sale here.</p>}
                {payment === "ETRANSFER" && <p className="text-sm text-muted">Check the e-Transfer arrived, then complete the sale.</p>}
                <div className="space-y-1 text-sm">
                  <Check checked={opts.handedOver} onChange={(v) => setOpts({ ...opts, handedOver: v })}>
                    They take it now
                  </Check>
                  <Check checked={opts.printTicket} onChange={(v) => setOpts({ ...opts, printTicket: v })}>
                    Print the order ticket
                  </Check>
                  <Check checked={opts.emailCustomer && !!customer.email.trim()} disabled={!customer.email.trim()} onChange={(v) => setOpts({ ...opts, emailCustomer: v })}>
                    Email the receipt {!customer.email.trim() && "(needs an email)"}
                  </Check>
                </div>
                {error && <p role="alert" className="rounded-2xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
                <Button size="lg" className="w-full" disabled={saving || !shownQuote?.ok || source.trim().length < 2} onClick={completeSale}>
                  {saving ? "Ringing up..." : `Complete sale${shownQuote?.ok ? ` · ${money(shownQuote.totalCents)}` : ""}`}
                </Button>
              </Card>
            )}
            {empty && error && <p role="alert" className="rounded-2xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
          </div>
        </div>
      )}

      {flip && <CustomerScreen screen={screen} onEmail={flipEmail} corner={<HoldToReturn onDone={() => setFlip(false)} />} />}
    </div>
  );
}

/** Paired display status, pairing by code, or "use this iPad". */
function DisplayControl({ registerId, online, onPaired, onUnpair, onFlip }: { registerId: string | null; online: boolean; onPaired: (id: string) => void; onUnpair: () => void; onFlip: () => void }) {
  const [pairing, setPairing] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function pair(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/pos/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const body = await res.json();
    if (!res.ok) return setError(body.error ?? "Couldn't pair.");
    setPairing(false);
    setCode("");
    onPaired(body.registerId);
  }
  if (registerId) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5">
          <span className={cn("h-2.5 w-2.5 rounded-full", online ? "bg-success" : "bg-danger")} />
          {online ? "Display connected" : "Display not responding"}
        </span>
        <button type="button" onClick={onUnpair} className="text-muted hover:text-fg">
          Unpair
        </button>
      </div>
    );
  }
  if (pairing) {
    return (
      <form onSubmit={pair} className="flex flex-wrap items-center gap-2 text-sm">
        <input autoFocus className={cn(input, "w-36 font-mono uppercase tracking-widest")} placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value)} maxLength={8} aria-label="Code on the display" />
        <Button type="submit" size="sm">
          Pair
        </Button>
        <button type="button" onClick={() => setPairing(false)} className="text-muted hover:text-fg">
          Cancel
        </button>
        {error && <p className="w-full text-danger">{error}</p>}
      </form>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Button variant="secondary" size="sm" onClick={() => setPairing(true)}>
        Pair a display
      </Button>
      <Button variant="ghost" size="sm" onClick={onFlip}>
        Turn to customer
      </Button>
      <Link href="/pos" target="_blank" className="text-muted underline-offset-4 hover:text-fg hover:underline">
        Open display
      </Link>
    </div>
  );
}

function CartRow({ name, detail, quantity, cents, onQty, onRemove, children }: { name: string; detail?: string; quantity: number; cents: number | null | undefined; onQty: (q: number) => void; onRemove: () => void; children?: React.ReactNode }) {
  return (
    <motion.li layout initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} className="py-2.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{name}</p>
          {detail && <p className="text-xs text-faint">{detail}</p>}
        </div>
        <div className="flex items-center rounded-full border border-line">
          <button type="button" aria-label="One less" onClick={() => (quantity > 1 ? onQty(quantity - 1) : onRemove())} className="h-8 w-8 text-muted hover:text-fg">
            −
          </button>
          <span className="w-6 text-center tabular-nums">{quantity}</span>
          <button type="button" aria-label="One more" onClick={() => onQty(Math.min(99, quantity + 1))} className="h-8 w-8 text-muted hover:text-fg">
            +
          </button>
        </div>
        <span className="w-20 text-right font-mono">{cents == null ? "..." : money(cents)}</span>
      </div>
      {children}
    </motion.li>
  );
}

/** "Custom keychain, $12". */
function CustomAdder({ onAdd }: { onAdd: (c: CustomLine) => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const cents = dollars(price);
  const ok = name.trim().length > 0 && cents != null && !Number.isNaN(cents) && cents >= 0;
  return (
    <Card className="p-4">
      <h2 className="mb-3 font-display text-lg font-semibold">Custom item</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!ok) return;
          onAdd({ name: name.trim(), unitCents: cents!, quantity: 1 });
          setName("");
          setPrice("");
        }}
        className="flex flex-wrap gap-2"
      >
        <input className={cn(input, "min-w-0 flex-[2]")} placeholder="What is it?" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label="Custom item name" />
        <input className={cn(input, "w-28 flex-1")} placeholder="$0.00" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Price" />
        <Button type="submit" variant="secondary" disabled={!ok}>
          Add
        </Button>
      </form>
    </Card>
  );
}

/** Coupons and gift cards. Gift cards need their PIN. */
function CodeAdder({ codes, rejected, onChange }: { codes: string[]; rejected: { code: string; reason: string }[]; onChange: (c: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const shown = (c: string) => c.split(":")[0];
  return (
    <div className="mt-3 border-t border-line pt-3 text-sm">
      <div className="flex flex-wrap gap-1.5">
        {codes.map((c) => {
          const bad = rejected.some((r) => r.code.replace(/\s/g, "") === shown(c).replace(/[\s-]/g, "").toUpperCase());
          return (
            <span key={c} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs", bad ? "bg-danger/10 text-danger" : "bg-accent-soft")}>
              {shown(c)}
              <button type="button" aria-label={`Remove ${shown(c)}`} onClick={() => onChange(codes.filter((x) => x !== c))}>
                ×
              </button>
            </span>
          );
        })}
        {!open && codes.length < 4 && (
          <button type="button" onClick={() => setOpen(true)} className="text-accent-text hover:underline">
            + Coupon or gift card
          </button>
        )}
      </div>
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!code.trim()) return;
            onChange([...codes, pin.trim() ? `${code.trim()}:${pin.trim()}` : code.trim()]);
            setCode("");
            setPin("");
            setOpen(false);
          }}
          className="mt-2 flex gap-2"
        >
          <input autoFocus className={cn(input, "h-9 flex-[2] font-mono")} placeholder="Code or card number" value={code} onChange={(e) => setCode(e.target.value)} />
          <input className={cn(input, "h-9 flex-1 font-mono")} placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
          <Button type="submit" size="sm">
            Apply
          </Button>
        </form>
      )}
    </div>
  );
}

/** Cash given, with quick amounts and the change to hand back. */
function CashTender({ totalCents, value, onChange }: { totalCents: number; value: string; onChange: (v: string) => void }) {
  const given = dollars(value);
  const change = given != null && !Number.isNaN(given) ? given - totalCents : null;
  const quick = [...new Set([totalCents, Math.ceil(totalCents / 500) * 500, Math.ceil(totalCents / 1000) * 1000, Math.ceil(totalCents / 2000) * 2000, Math.ceil(totalCents / 5000) * 5000, 10000].filter((c) => c >= totalCents))].slice(0, 5);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {quick.map((c) => (
          <button key={c} type="button" onClick={() => onChange((c / 100).toFixed(2))} className={cn("rounded-full border px-3 py-1 text-sm", given === c ? "border-accent-line bg-accent text-accent-ink" : "border-line text-muted hover:text-fg")}>
            {c === totalCents ? "Exact" : money(c)}
          </button>
        ))}
      </div>
      <Field label="Cash given">
        <input className={input} inputMode="decimal" placeholder="$0.00" value={value} onChange={(e) => onChange(e.target.value)} />
      </Field>
      {change != null && (
        <p className={cn("flex justify-between text-lg font-semibold", change < 0 && "text-danger")}>
          <span>{change < 0 ? "Still owed" : "Change"}</span>
          <span className="font-mono">{money(Math.abs(change))}</span>
        </p>
      )}
    </div>
  );
}

function SaleDone({ done, payment, onNew, onShowThanks }: { done: Done; payment: PosPayment; onNew: () => void; onShowThanks: () => void }) {
  return (
    <Card className="mx-auto max-w-md p-8 text-center">
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 320, damping: 16 }} className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-3xl text-accent-ink">
        ✓
      </motion.div>
      <p className="mt-4 font-display text-2xl font-bold">Sale complete</p>
      <p className="mt-1 text-muted">
        <Link href={`/admin/orders/${done.orderId}`} className="font-mono text-accent-text hover:underline">
          {done.orderNumber}
        </Link>
        {done.emailed && " · receipt emailed"}
      </p>
      {payment === "CASH" && done.changeCents != null && (
        <p className="mt-4 text-3xl font-bold">
          Change <span className="font-mono">{money(done.changeCents)}</span>
        </p>
      )}
      <div className="mt-6 flex flex-col gap-2">
        <Button size="lg" onClick={onNew} autoFocus>
          New sale
        </Button>
        <Button variant="ghost" onClick={onShowThanks}>
          Show thank you on this screen
        </Button>
      </div>
    </Card>
  );
}

/** One-iPad mode: the customer can't leave by accident; the cashier holds this for a second. */
function HoldToReturn({ onDone }: { onDone: () => void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    setHolding(false);
    if (timer.current) clearTimeout(timer.current);
  };
  return (
    <button
      type="button"
      aria-label="Hold to go back to the register"
      onPointerDown={() => {
        setHolding(true);
        timer.current = setTimeout(() => {
          stop();
          onDone();
        }, 900);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onContextMenu={(e) => e.preventDefault()}
      className="relative h-10 w-10 select-none overflow-hidden rounded-full border border-line text-faint"
    >
      <span className={cn("absolute inset-0 origin-bottom bg-accent-soft transition-transform ease-linear", holding ? "scale-y-100 duration-[900ms]" : "scale-y-0 duration-150")} />
      <span className="relative text-lg">⌂</span>
    </button>
  );
}

function Check({ checked, disabled, onChange, children }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className={cn("flex items-center gap-2", disabled && "text-faint")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /> {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-muted">
      <dt>{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
