"use client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Field, fieldInput as input, PrintFiles, toCartItems, type FileLine, type PrintOptions } from "@/components/admin/PrintFiles";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { POS_BRANDS, type CustomLine, type PosBrand, type PosCartInput, type PosLineView, type PosPayment, type PosPopup, type PosQuote, type PosReply, type PosSaleInput, type PosScreen } from "@/lib/pos/types";
import { needsVariant, unitPrice, type ShopProductDto } from "@/lib/shop/types";
import { AnimatedMoney, DrawnCheck, Modal, Qr, Thumb, useForceDark } from "./bits";
import { CustomerScreen, type ReplyFn } from "./CustomerScreen";

type ProductLine = { key: string; productId: string; variantId: string | null; quantity: number; customText: string };
type PayKind = PosPayment | "LINK";
type Done = { orderId: string; orderNumber: string; changeCents: number | null; emailed: boolean; screen: PosScreen };
type PayLink = { linkId: string; url: string; orderId: string; amountCents: number };
type Panel = null | "custom" | "print" | "codes" | "customer" | "send" | { product: ShopProductDto };
export type RegisterLinks = { etransferEmail: string | null; instagram: string; review: string | null; payLinks: boolean };

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
const popupId = () => crypto.randomUUID().slice(0, 12);

const PAY_TILES: { id: PayKind; label: string; hint: string; icon: string }[] = [
  { id: "CASH", label: "Cash", hint: "Work out change", icon: "💵" },
  { id: "CARD", label: "Card reader", hint: "Your own reader", icon: "💳" },
  { id: "LINK", label: "Scan to pay", hint: "Square QR on the display", icon: "📱" },
  { id: "ETRANSFER", label: "e-Transfer", hint: "Shows where to send", icon: "🏦" },
  { id: "OTHER", label: "Other", hint: "Anything else", icon: "✳︎" },
];

/**
 * The cashier side of the register, dark and tile based. Tap products to
 * ring them up; custom items, prints, codes, customer details and payment
 * each open as a popup. The customer follows along on a paired display (or
 * this iPad turned around), where the cashier can also put popups: a receipt
 * email box, joining rewards, a Square QR to pay, e-Transfer details, links
 * to scan and notes.
 */
export function Register({ products, printOptions, links }: { products: Record<PosBrand, ShopProductDto[]>; printOptions: PrintOptions; links: RegisterLinks }) {
  useForceDark();
  const router = useRouter();
  const [brand, setBrandState] = useState<PosBrand>("lightlab");
  const [source, setSource] = useState<string>(POS_BRANDS[0].source);
  const [registerId, setRegisterId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [flip, setFlip] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [pay, setPay] = useState<PayKind | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  const [lines, setLines] = useState<ProductLine[]>([]);
  const [custom, setCustom] = useState<(CustomLine & { key: string })[]>([]);
  const [files, setFiles] = useState<FileLine[]>([]);
  const [codes, setCodes] = useState<string[]>([]);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", notes: "" });
  const [popup, setPopup] = useState<PosPopup | null>(null);
  const [tendered, setTendered] = useState("");
  const [opts, setOpts] = useState({ handedOver: true, printTicket: false, emailCustomer: true });
  const [quote, setQuote] = useState<PosQuote | null>(null);
  const [attemptId, setAttemptId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [link, setLink] = useState<PayLink | null>(null);

  const say = (text: string) => setToast({ id: Date.now(), text });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // This device's brand, its source and the paired display.
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
    }, 220);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [cart, empty]);
  const shownQuote = empty ? null : quote;
  const total = shownQuote?.ok ? shownQuote.totalCents : null;
  const tenderedCents = pay === "CASH" ? dollars(tendered) : null;

  // What the customer sees.
  const screen: PosScreen = useMemo(() => {
    if (done) return { ...done.screen, popup };
    const base = { brand, popup, email: customer.email || undefined };
    if (empty || !shownQuote) return { stage: "idle", ...base };
    return { stage: "cart", ...base, lines: shownQuote.lines, fees: shownQuote.fees, discounts: shownQuote.discounts, totalCents: shownQuote.totalCents, payment: pay, tenderedCents: tenderedCents != null && !Number.isNaN(tenderedCents) ? tenderedCents : null };
  }, [done, empty, shownQuote, brand, pay, tenderedCents, customer.email, popup]);

  // Push it to the paired display (lightly debounced so typing doesn't flood it).
  const lastPushed = useRef("");
  const clearReplyNext = useRef(false);
  useEffect(() => {
    if (!registerId) return;
    const json = JSON.stringify(screen);
    if (json === lastPushed.current) return;
    const t = setTimeout(async () => {
      const clearReply = clearReplyNext.current;
      clearReplyNext.current = false;
      const res = await fetch(`/api/admin/pos/registers/${registerId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ screen, clearReply }) }).catch(() => null);
      if (res?.status === 404) unpair(false);
      else if (res?.ok) lastPushed.current = json;
    }, 120);
    return () => clearTimeout(t);
  }, [screen, registerId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The customer answered a popup (on the display, or on this iPad turned around). */
  const handleReply = useCallback((r: PosReply) => {
    setPopup((p) => (p?.id === r.popupId ? null : p));
    if (r.email) setCustomer((c) => ({ ...c, email: r.email!, name: c.name || r.name || "" }));
    if (r.kind === "email") say(`Receipt will go to ${r.email}`);
    if (r.kind === "account") say(r.created ? `Welcome ${r.name || r.email}! Account made, sign-in link on its way.` : `${r.email} already has an account. Points go there.`);
    if (r.kind === "dismiss") say("Customer closed the popup");
  }, []);

  // Pick up answers from the paired display.
  const seenReply = useRef<string | null>(null);
  useEffect(() => {
    if (!registerId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`/api/admin/pos/registers/${registerId}`, { cache: "no-store" });
        if (res.status === 404) return unpair(false);
        const body = (await res.json()) as { reply: PosReply | null; online: boolean };
        setOnline(body.online);
        const key = body.reply ? `${body.reply.popupId}:${body.reply.at}` : null;
        if (body.reply && key !== seenReply.current) {
          seenReply.current = key;
          handleReply(body.reply);
        }
      } catch {
        setOnline(false);
      }
      if (!stopped) timer = setTimeout(tick, 1200);
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [registerId, handleReply]); // eslint-disable-line react-hooks/exhaustive-deps

  // On this iPad turned around: answers are handled here, then it comes back to the register.
  const flipReply: ReplyFn = async (a) => {
    if (a.kind === "account" && a.email) {
      // Same as the display: the server makes the account.
      const res = await fetch("/api/admin/pos/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: a.email, name: a.name }) });
      const body = await res.json();
      if (!res.ok) return body.error ?? "That didn't work.";
      handleReply({ popupId: a.popupId, kind: "account", email: a.email, name: a.name, created: body.created, at: Date.now() });
    } else {
      handleReply({ popupId: a.popupId, kind: a.kind, email: a.email, name: a.name, at: Date.now() });
    }
    setFlip(false);
    return null;
  };

  function unpair(tellServer = true) {
    if (tellServer && registerId) fetch(`/api/admin/pos/registers/${registerId}`, { method: "DELETE" }).catch(() => undefined);
    store.set("register", null);
    setRegisterId(null);
    lastPushed.current = "";
  }

  /** Put a popup in front of the customer: on the display, or by turning this iPad around. */
  function show(p: PosPopup) {
    setPopup(p);
    setPanel(null);
    if (!registerId) setFlip(true);
  }

  function addProduct(p: ShopProductDto, variantId: string | null = null, customText = "", quantity = 1) {
    setDone(null);
    if ((needsVariant(p) && !variantId) || (p.personalize && !customText)) return setPanel({ product: p });
    setLines((ls) => {
      const same = ls.find((l) => l.productId === p.id && l.variantId === variantId && l.customText === customText);
      return same ? ls.map((l) => (l === same ? { ...l, quantity: l.quantity + quantity } : l)) : [...ls, { key: crypto.randomUUID(), productId: p.id, variantId, quantity, customText }];
    });
  }

  function newSale() {
    if (link) cancelLink(link);
    setLines([]);
    setCustom([]);
    setFiles([]);
    setCodes([]);
    setCustomer({ name: "", email: "", phone: "", notes: "" });
    setPopup(null);
    setPay(null);
    setTendered("");
    setOpts({ handedOver: true, printTicket: false, emailCustomer: true });
    setQuote(null);
    setError(null);
    setDone(null);
    setFlip(false);
    setLink(null);
    setAttemptId(crypto.randomUUID());
    // Fresh stock counts on the tiles after a sale.
    if (done) router.refresh();
    seenReply.current = null;
    clearReplyNext.current = true;
  }

  // Prints still need printing: default to not handed over, with a ticket.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follows whether the cart has prints
    setOpts((o) => ({ ...o, handedOver: !hasPrints, printTicket: hasPrints }));
  }, [hasPrints]);

  async function completeSale(payment: PosPayment, squarePaymentId: string | null = null) {
    if (!shownQuote?.ok) return;
    setError(null);
    if (payment === "CASH" && tenderedCents != null && (Number.isNaN(tenderedCents) || tenderedCents < shownQuote.totalCents)) return setError("That's less cash than the total.");
    setSaving(true);
    store.set(`source:${brand}`, source);
    const body: PosSaleInput = {
      attemptId,
      cart,
      expectedTotalCents: shownQuote.totalCents,
      payment,
      squarePaymentId,
      tenderedCents: payment === "CASH" ? tenderedCents : null,
      source,
      customer,
      ...opts,
      emailCustomer: opts.emailCustomer && !!customer.email.trim(),
      registerId,
    };
    try {
      const res = await fetch("/api/admin/pos/sale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = await res.json();
      if (!res.ok) {
        if (out.quote) setQuote(out.quote);
        throw new Error(out.error ?? "Couldn't ring up the sale.");
      }
      const thanks: PosScreen = { stage: "done", brand, lines: shownQuote.lines, totalCents: shownQuote.totalCents, payment: squarePaymentId ? "LINK" : payment, email: customer.email || undefined, orderNumber: out.orderNumber, emailed: out.emailed, popup: null };
      lastPushed.current = JSON.stringify(thanks); // the server already showed it on the display
      setPopup(null);
      setPay(null);
      setLink(null);
      setDone({ orderId: out.orderId, orderNumber: out.orderNumber, changeCents: out.changeCents, emailed: out.emailed, screen: thanks });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ----- Payment popups -----
  async function openPay(kind: PayKind) {
    if (!shownQuote?.ok) return;
    setError(null);
    setPay(kind);
    if (kind === "ETRANSFER" && links.etransferEmail) {
      setPopup({ id: popupId(), kind: "etransfer", sendTo: links.etransferEmail, amountCents: shownQuote.totalCents, message: `${brand === "lightlab" ? "LightLab" : "Coastline"} ${attemptId.slice(0, 4).toUpperCase()}` });
    }
    if (kind === "LINK") {
      try {
        const res = await fetch("/api/admin/pos/paylink", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attemptId, amountCents: shownQuote.totalCents, brand }) });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Couldn't make the link.");
        const l = { ...body, amountCents: shownQuote.totalCents } as PayLink;
        setLink(l);
        setPopup({ id: popupId(), kind: "card-link", url: l.url, amountCents: l.amountCents });
      } catch (err) {
        setError((err as Error).message);
      }
    }
  }

  function cancelLink(l: PayLink) {
    fetch(`/api/admin/pos/paylink?linkId=${encodeURIComponent(l.linkId)}`, { method: "DELETE" }).catch(() => undefined);
  }

  function closePay() {
    if (pay === "LINK" && link) cancelLink(link);
    if (popup?.kind === "card-link" || popup?.kind === "etransfer") setPopup(null);
    setLink(null);
    setPay(null);
    setError(null);
  }

  // Watch the Square link; once it's paid, show it and ring up the sale.
  useEffect(() => {
    if (!link || pay !== "LINK") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`/api/admin/pos/paylink?orderId=${encodeURIComponent(link.orderId)}`, { cache: "no-store" });
        const body = (await res.json()) as { paid: boolean; paymentId?: string };
        if (body.paid && body.paymentId) {
          stopped = true;
          setPopup((p) => (p?.kind === "card-link" ? { ...p, paid: true } : p));
          // Let the "Paid!" tick play on the display, then finish.
          setTimeout(() => completeSale("CARD", body.paymentId!), 1400);
          return;
        }
      } catch {}
      if (!stopped) timer = setTimeout(tick, 2000);
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [link, pay]); // eslint-disable-line react-hooks/exhaustive-deps

  const productCount = (id: string) => lines.filter((l) => l.productId === id).reduce((n, l) => n + l.quantity, 0);
  const quoteLine = (key: string): PosLineView | undefined => shownQuote?.lines.find((l) => l.key === key);
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0) + custom.reduce((n, c) => n + c.quantity, 0) + files.reduce((n, f) => n + f.quantity, 0);

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold">Register</h1>
          <div className="w-64">
            <Segmented label="Selling as" value={brand} onChange={setBrand} options={POS_BRANDS.map((b) => ({ value: b.id, label: b.name }))} />
          </div>
        </div>
        <DisplayControl registerId={registerId} online={online} onPaired={(id) => { store.set("register", id); setRegisterId(id); lastPushed.current = ""; say("Display paired"); }} onUnpair={() => unpair()} onFlip={() => setFlip(true)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        {/* Tiles */}
        <div className="space-y-4">
          <div className={cn("grid gap-3", brand === "coastline" ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4")}>
            <ActionTile icon="＋" label="Custom item" onClick={() => setPanel("custom")} />
            {brand === "coastline" && <ActionTile icon="⬡" label="Print from file" badge={files.length || undefined} onClick={() => setPanel("print")} />}
            <ActionTile icon="🎟" label="Code or gift card" badge={codes.length || undefined} onClick={() => setPanel("codes")} />
            <ActionTile icon="👤" label={customer.name || customer.email ? (customer.name || customer.email).split("@")[0] : "Customer"} active={!!(customer.name || customer.email)} onClick={() => setPanel("customer")} />
            <ActionTile icon="📺" label="Send to display" active={!!popup} onClick={() => setPanel("send")} />
          </div>

          {shopProducts.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {shopProducts.map((p, i) => {
                const left = p.variants.some((v) => v.stock != null) ? null : p.stock;
                const n = productCount(p.id);
                return (
                  <motion.button
                    key={p.id}
                    type="button"
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.025, 0.3) }}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => addProduct(p)}
                    disabled={left === 0}
                    className={cn("relative overflow-hidden rounded-3xl border bg-surface text-left transition-colors disabled:opacity-35", n ? "border-accent-line" : "border-line hover:border-line-strong")}
                  >
                    <div className="aspect-square bg-surface-strong">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.images[0] ? <img src={p.images[0]} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center font-display text-4xl text-faint">{p.name.charAt(0)}</span>}
                    </div>
                    <div className="p-3">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="text-sm text-muted">
                        {money(p.priceCents)}
                        {needsVariant(p) && " +"}
                        {left != null && <span className={cn("ml-1", left <= 2 && "text-warning")}>· {left} left</span>}
                      </p>
                    </div>
                    <AnimatePresence>
                      {n > 0 && (
                        <motion.span key={n} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 600, damping: 18 }} className="absolute right-2 top-2 grid h-9 min-w-9 place-items-center rounded-full bg-accent px-2 font-bold text-accent-ink shadow-lg">
                          {n}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-3xl border border-dashed border-line p-10 text-center text-muted">No {brand === "lightlab" ? "LightLab" : "Coastline shop"} products yet. Custom items still work.</p>
          )}
        </div>

        {/* Ticket */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-3xl border border-line bg-elev">
            <div className="flex items-center justify-between px-5 pt-4">
              <h2 className="font-display text-lg font-semibold">
                Sale {itemCount > 0 && <span className="text-muted">· {itemCount}</span>}
              </h2>
              {!empty && (
                <button type="button" onClick={newSale} className="text-sm text-muted hover:text-danger">
                  Clear
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
              {empty ? (
                <div className="grid place-items-center py-14 text-center text-muted">
                  <motion.span animate={{ y: [0, -6, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} className="text-4xl">
                    🛍
                  </motion.span>
                  <p className="mt-2 text-sm">Tap a product to start.</p>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  <AnimatePresence initial={false}>
                    {files.map((f, i) => (
                      <TicketRow key={f.key} line={quoteLine(`print-${i}`) ?? { key: f.key, kind: "print", name: f.upload.name, quantity: f.quantity, cents: null }} onQty={(q) => setFiles((fs) => fs.map((x) => (x.key === f.key ? { ...x, quantity: q } : x)))} onRemove={() => setFiles((fs) => fs.filter((x) => x.key !== f.key))} />
                    ))}
                    {lines.map((l, i) => {
                      const p = productOf(l.productId);
                      if (!p) return null;
                      return <TicketRow key={l.key} line={quoteLine(`product-${i}`) ?? { key: l.key, kind: "product", name: p.name, quantity: l.quantity, cents: null, image: p.images[0] }} onQty={(q) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, quantity: q } : x)))} onRemove={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} />;
                    })}
                    {custom.map((c, i) => (
                      <TicketRow key={c.key} line={quoteLine(`custom-${i}`) ?? { key: c.key, kind: "custom", name: c.name, quantity: c.quantity, cents: c.unitCents * c.quantity }} onQty={(q) => setCustom((cs) => cs.map((x) => (x.key === c.key ? { ...x, quantity: q } : x)))} onRemove={() => setCustom((cs) => cs.filter((x) => x.key !== c.key))} />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {shownQuote && (
              <div className="border-t border-line px-5 py-3 text-sm">
                {shownQuote.fees.map((f) => <Row key={f.label} label={f.label} value={money(f.cents)} />)}
                {shownQuote.discounts.map((d) => <Row key={d.label} label={d.label} value={`−${money(d.cents)}`} good />)}
                {shownQuote.error && <p className="mt-1 text-danger">{shownQuote.error}</p>}
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="font-semibold">Total</span>
                  <AnimatedMoney cents={shownQuote.totalCents} className="font-display text-4xl font-bold" />
                </div>
                {(customer.email || customer.name) && <p className="mt-1 truncate text-xs text-faint">For {[customer.name, customer.email].filter(Boolean).join(" · ")}</p>}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 border-t border-line p-3">
              {PAY_TILES.filter((t) => t.id !== "LINK" || links.payLinks).map((t) => (
                <motion.button
                  key={t.id}
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  disabled={total == null || (t.id === "LINK" && (total ?? 0) < 100)}
                  onClick={() => openPay(t.id)}
                  title={t.hint}
                  className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface px-2 py-3 text-sm font-semibold transition-colors hover:border-accent-line hover:bg-surface-strong disabled:opacity-35"
                >
                  <span className="text-2xl" aria-hidden>
                    {t.icon}
                  </span>
                  {t.label}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ----- Popups ----- */}
      <Modal open={panel === "custom"} onClose={() => setPanel(null)} title="Custom item">
        <CustomForm
          onAdd={(c) => {
            setDone(null);
            setCustom((l) => [...l, { ...c, key: crypto.randomUUID() }]);
            setPanel(null);
          }}
        />
      </Modal>

      <Modal open={panel === "print"} onClose={() => setPanel(null)} title="Print from a file" wide footer={<Button className="w-full" onClick={() => setPanel(null)}>Done</Button>}>
        <PrintFiles files={files} onChange={setFiles} options={printOptions} onError={setError} />
      </Modal>

      <Modal open={panel === "codes"} onClose={() => setPanel(null)} title="Coupon or gift card">
        <CodesForm codes={codes} rejected={shownQuote?.rejected ?? []} onChange={setCodes} />
      </Modal>

      <Modal open={panel === "customer"} onClose={() => setPanel(null)} title="Customer" footer={<Button className="w-full" onClick={() => setPanel(null)}>Done</Button>}>
        <div className="grid gap-3">
          <Field label="Name">
            <input className={input} value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
          </Field>
          <Field label="Email (for the receipt and rewards)">
            <input className={input} type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className={input} type="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
          </Field>
          <Field label="Notes">
            <input className={input} value={customer.notes} maxLength={1000} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} />
          </Field>
          <Field label="Where's it from?">
            <input className={input} value={source} maxLength={60} onChange={(e) => setSource(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => show({ id: popupId(), kind: "email" })}>
              Let them type it
            </Button>
            <Button variant="secondary" onClick={() => show({ id: popupId(), kind: "account" })}>
              Join rewards
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={panel === "send"} onClose={() => setPanel(null)} title="Send to the display" wide>
        <SendPanel brand={brand} popup={popup} links={links} onSend={show} onClear={() => setPopup(null)} hasDisplay={!!registerId} />
      </Modal>

      <Modal open={typeof panel === "object" && panel !== null} onClose={() => setPanel(null)} title={typeof panel === "object" && panel ? panel.product.name : ""}>
        {typeof panel === "object" && panel && (
          <ProductOptions
            product={panel.product}
            onAdd={(variantId, text, qty) => {
              addProduct(panel.product, variantId, text, qty);
              setPanel(null);
            }}
          />
        )}
      </Modal>

      <Modal open={!!pay && !done} onClose={saving ? undefined : closePay} title={PAY_TILES.find((t) => t.id === pay)?.label} footer={pay && pay !== "LINK" ? <PayFooter opts={opts} setOpts={setOpts} hasEmail={!!customer.email.trim()} /> : undefined}>
        {total != null && pay && (
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-muted">Total</span>
              <AnimatedMoney cents={total} className="font-display text-4xl font-bold" />
            </div>
            {pay === "CASH" && <CashTender totalCents={total} value={tendered} onChange={setTendered} />}
            {pay === "CARD" && <p className="text-muted">Take the card on your reader. Once it&apos;s approved, finish here.</p>}
            {pay === "OTHER" && <p className="text-muted">Paid some other way? Note it in the customer notes, then finish here.</p>}
            {pay === "ETRANSFER" &&
              (links.etransferEmail && popup?.kind === "etransfer" ? (
                <div className="space-y-2 rounded-2xl bg-surface p-4 text-sm">
                  <Row label="Send to" value={popup.sendTo} />
                  <Row label="Amount" value={money(popup.amountCents)} />
                  <Row label="Message" value={popup.message} />
                  <p className="pt-1 text-faint">{registerId ? "Showing on the display." : "Turn the iPad around to show them."} Finish once they show you the confirmation.</p>
                </div>
              ) : (
                <p className="text-muted">Set ETRANSFER_EMAIL on the server to show where to send it.</p>
              ))}
            {pay === "LINK" && <LinkPanel link={link} paid={popup?.kind === "card-link" && !!popup.paid} hasDisplay={!!registerId} onShow={() => setFlip(true)} />}
            {error && (
              <motion.p initial={{ x: -6 }} animate={{ x: [0, -6, 6, 0] }} role="alert" className="rounded-2xl bg-danger/10 p-3 text-sm text-danger">
                {error}
              </motion.p>
            )}
            {pay !== "LINK" && (
              <Button size="lg" className="w-full" disabled={saving} onClick={() => completeSale(pay as PosPayment)}>
                {saving ? "Ringing up..." : pay === "CASH" ? "Cash received, finish" : pay === "ETRANSFER" ? "Got the confirmation, finish" : "Finish sale"}
              </Button>
            )}
            {pay !== "LINK" && (pay === "ETRANSFER" || pay === "CASH") && !registerId && (
              <Button variant="ghost" className="w-full" onClick={() => setFlip(true)}>
                Show the customer
              </Button>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!done && !flip}>
        {done && <SaleDone done={done} onNew={newSale} onShowThanks={() => setFlip(true)} />}
      </Modal>

      {!pay && error && !done && (
        <div className="fixed bottom-6 left-1/2 z-[150] -translate-x-1/2 rounded-full bg-danger px-5 py-2.5 text-sm font-medium text-white shadow-xl" role="alert" onClick={() => setError(null)}>
          {error}
        </div>
      )}
      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} initial={{ opacity: 0, y: 30, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-6 left-1/2 z-[350] -translate-x-1/2 rounded-full border border-line bg-elev px-5 py-3 text-sm font-medium shadow-2xl">
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Above every cashier popup: the customer only sees their screen. */}
      {flip && (
        <div className="relative z-[400]">
          <CustomerScreen screen={screen} onReply={flipReply} corner={<HoldToReturn onDone={() => setFlip(false)} />} />
        </div>
      )}
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
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {registerId ? (
        <>
          <span className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5">
            <motion.span className={cn("h-2.5 w-2.5 rounded-full", online ? "bg-success" : "bg-danger")} animate={online ? { opacity: [1, 0.4, 1] } : {}} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
            {online ? "Display connected" : "Display not responding"}
          </span>
          <button type="button" onClick={onUnpair} className="text-muted hover:text-fg">
            Unpair
          </button>
        </>
      ) : (
        <>
          <Button variant="secondary" size="sm" onClick={() => setPairing(true)}>
            Pair a display
          </Button>
          <Link href="/pos" target="_blank" className="text-muted underline-offset-4 hover:text-fg hover:underline">
            Open display
          </Link>
        </>
      )}
      <Button variant="ghost" size="sm" onClick={onFlip}>
        Turn to customer
      </Button>
      <Modal open={pairing} onClose={() => setPairing(false)} title="Pair a display">
        <form onSubmit={pair} className="space-y-4">
          <p className="text-muted">Open coastlineprints.ca/pos on the customer&apos;s tablet and type the code it shows.</p>
          <input autoFocus className={cn(input, "h-16 text-center font-mono text-3xl uppercase tracking-[0.3em]")} placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value)} maxLength={8} aria-label="Code on the display" />
          {error && <p className="text-danger">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={code.replace(/\W/g, "").length < 6}>
            Pair
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function ActionTile({ icon, label, badge, active, onClick }: { icon: string; label: string; badge?: number; active?: boolean; onClick: () => void }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.93 }} whileHover={{ y: -2 }} onClick={onClick} className={cn("relative flex min-h-24 flex-col justify-between rounded-3xl border p-4 text-left transition-colors", active ? "border-accent-line bg-accent-soft" : "border-line bg-surface hover:border-line-strong")}>
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      <span className="truncate font-semibold">{label}</span>
      {badge != null && <span className="absolute right-3 top-3 grid h-7 min-w-7 place-items-center rounded-full bg-accent px-1.5 text-sm font-bold text-accent-ink">{badge}</span>}
    </motion.button>
  );
}

function TicketRow({ line, onQty, onRemove }: { line: PosLineView; onQty: (q: number) => void; onRemove: () => void }) {
  return (
    <motion.li layout initial={{ opacity: 0, x: 24, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -24, height: 0 }} transition={{ type: "spring", stiffness: 500, damping: 34 }} className="flex items-center gap-3 rounded-2xl bg-surface p-2">
      <Thumb line={line} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{line.name}</p>
        {line.error ? <p className="truncate text-xs text-danger">{line.error}</p> : line.detail && <p className="truncate text-xs text-faint">{line.detail}</p>}
      </div>
      <div className="flex items-center rounded-full bg-bg">
        <button type="button" aria-label="One less" onClick={() => (line.quantity > 1 ? onQty(line.quantity - 1) : onRemove())} className="grid h-8 w-8 place-items-center text-muted hover:text-fg">
          {line.quantity > 1 ? "−" : "🗑"}
        </button>
        <motion.span key={line.quantity} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="w-5 text-center text-sm tabular-nums">
          {line.quantity}
        </motion.span>
        <button type="button" aria-label="One more" onClick={() => onQty(Math.min(99, line.quantity + 1))} className="grid h-8 w-8 place-items-center text-muted hover:text-fg">
          +
        </button>
      </div>
      <span className="w-16 text-right font-mono text-sm">{line.cents == null ? "..." : money(line.cents)}</span>
    </motion.li>
  );
}

/** Pick an option (shade colour...) and fill in the personalisation. */
function ProductOptions({ product: p, onAdd }: { product: ShopProductDto; onAdd: (variantId: string | null, text: string, qty: number) => void }) {
  const [variant, setVariant] = useState<string | null>(needsVariant(p) ? (p.variants.find((v) => v.stock !== 0)?.id ?? null) : null);
  const [text, setText] = useState("");
  const [qty, setQty] = useState(1);
  const ok = (!needsVariant(p) || !!variant) && (!p.personalize || !!text.trim());
  return (
    <div className="space-y-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {p.images[0] && <img src={p.images[0]} alt="" className="aspect-[16/9] w-full rounded-2xl object-cover" />}
      {needsVariant(p) && (
        <div className="grid grid-cols-2 gap-2">
          {p.variants.map((v) => (
            <motion.button key={v.id} type="button" whileTap={{ scale: 0.95 }} disabled={v.stock === 0} onClick={() => setVariant(v.id)} className={cn("flex items-center gap-2 rounded-2xl border p-3 text-left text-sm disabled:opacity-35", variant === v.id ? "border-accent-line bg-accent-soft" : "border-line bg-surface")}>
              {v.hex && <span className="h-5 w-5 shrink-0 rounded-full border border-line" style={{ background: v.hex }} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{v.name}</span>
                <span className="text-muted">
                  {money(unitPrice(p, v.id))}
                  {v.stock != null && ` · ${v.stock} left`}
                </span>
              </span>
            </motion.button>
          ))}
        </div>
      )}
      {p.personalize && (
        <Field label={p.personalize}>
          <input autoFocus className={input} value={text} maxLength={24} onChange={(e) => setText(e.target.value)} />
        </Field>
      )}
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-full border border-line">
          <button type="button" className="h-11 w-11 text-lg" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="One less">
            −
          </button>
          <span className="w-8 text-center tabular-nums">{qty}</span>
          <button type="button" className="h-11 w-11 text-lg" onClick={() => setQty(Math.min(20, qty + 1))} aria-label="One more">
            +
          </button>
        </div>
        <Button size="lg" className="flex-1" disabled={!ok} onClick={() => onAdd(variant, text.trim(), qty)}>
          Add {money(unitPrice(p, variant) * qty)}
        </Button>
      </div>
    </div>
  );
}

/** "Custom keychain, $12", with a number pad feel for the price. */
function CustomForm({ onAdd }: { onAdd: (c: CustomLine) => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState(1);
  const cents = dollars(price);
  const ok = name.trim().length > 0 && cents != null && !Number.isNaN(cents) && cents >= 0;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onAdd({ name: name.trim(), unitCents: cents!, quantity: qty });
      }}
      className="space-y-3"
    >
      <Field label="What is it?">
        <input autoFocus className={input} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Custom keychain" />
      </Field>
      <Field label="Price each">
        <input className={cn(input, "h-16 text-center font-display text-3xl font-bold")} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$0.00" />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {[5, 10, 15, 20, 25, 30, 40, 50].map((d) => (
          <button key={d} type="button" onClick={() => setPrice(String(d))} className={cn("rounded-full border px-3 py-1 text-sm", cents === d * 100 ? "border-accent-line bg-accent text-accent-ink" : "border-line text-muted hover:text-fg")}>
            ${d}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 pt-1">
        <div className="flex items-center rounded-full border border-line">
          <button type="button" className="h-11 w-11 text-lg" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="One less">
            −
          </button>
          <span className="w-8 text-center tabular-nums">{qty}</span>
          <button type="button" className="h-11 w-11 text-lg" onClick={() => setQty(Math.min(99, qty + 1))} aria-label="One more">
            +
          </button>
        </div>
        <Button type="submit" size="lg" className="flex-1" disabled={!ok}>
          Add{ok ? ` ${money(cents! * qty)}` : ""}
        </Button>
      </div>
    </form>
  );
}

/** Coupons and gift cards. Gift cards need their PIN. */
function CodesForm({ codes, rejected, onChange }: { codes: string[]; rejected: { code: string; reason: string }[]; onChange: (c: string[]) => void }) {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const shown = (c: string) => c.split(":")[0];
  const problem = (c: string) => rejected.find((r) => r.code.replace(/[\s-]/g, "").toUpperCase() === shown(c).replace(/[\s-]/g, "").toUpperCase())?.reason;
  return (
    <div className="space-y-4">
      {codes.length > 0 && (
        <ul className="space-y-2">
          {codes.map((c) => (
            <li key={c} className={cn("flex items-center justify-between gap-3 rounded-2xl p-3", problem(c) ? "bg-danger/10" : "bg-surface")}>
              <div>
                <p className="font-mono">{shown(c)}</p>
                {problem(c) && <p className="text-sm text-danger">{problem(c)}</p>}
              </div>
              <button type="button" className="text-sm text-muted hover:text-danger" onClick={() => onChange(codes.filter((x) => x !== c))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {codes.length < 4 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!code.trim()) return;
            onChange([...codes, pin.trim() ? `${code.trim()}:${pin.trim()}` : code.trim()]);
            setCode("");
            setPin("");
          }}
          className="space-y-3"
        >
          <Field label="Code or gift card number">
            <input autoFocus className={cn(input, "font-mono")} value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label="PIN (gift cards)">
            <input className={cn(input, "font-mono")} value={pin} onChange={(e) => setPin(e.target.value)} placeholder="CP#####" />
          </Field>
          <Button type="submit" className="w-full" disabled={!code.trim()}>
            Apply
          </Button>
        </form>
      )}
    </div>
  );
}

/** Things to put on the customer's screen. */
function SendPanel({ brand, popup, links, onSend, onClear, hasDisplay }: { brand: PosBrand; popup: PosPopup | null; links: RegisterLinks; onSend: (p: PosPopup) => void; onClear: () => void; hasDisplay: boolean }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const tiles: { icon: string; label: string; hint: string; popup: () => PosPopup; show: boolean }[] = [
    { icon: "✉️", label: "Receipt email", hint: "They type their email", popup: () => ({ id: popupId(), kind: "email" }), show: true },
    { icon: "⭐", label: "Join rewards", hint: "Makes their account", popup: () => ({ id: popupId(), kind: "account" }), show: true },
    { icon: "📸", label: "Follow on Instagram", hint: "QR to @coastline.printz", popup: () => ({ id: popupId(), kind: "qr", title: "Follow along on Instagram", text: "New prints, behind the scenes and giveaways.", url: links.instagram }), show: brand === "coastline" },
    { icon: "💬", label: "Leave a review", hint: "QR to Google reviews", popup: () => ({ id: popupId(), kind: "qr", title: "Enjoyed it? Leave a review", text: "It really helps a small local shop.", url: links.review ?? "" }), show: brand === "coastline" && !!links.review },
    { icon: "🛒", label: "Shop online", hint: `QR to the ${brand === "lightlab" ? "LightLab" : "Coastline"} shop`, popup: () => ({ id: popupId(), kind: "qr", title: "Shop online any time", text: brand === "lightlab" ? "Every lamp, with shipping across Canada." : "Upload a file or shop ready-made prints.", url: `https://coastlineprints.ca${brand === "lightlab" ? "/lightlab" : "/shop"}` }), show: true },
  ];
  return (
    <div className="space-y-5">
      {!hasDisplay && <p className="rounded-2xl bg-surface p-3 text-sm text-muted">No display paired: this iPad will turn to the customer. Hold the ⌂ button to come back.</p>}
      {popup && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-accent-soft p-3 text-sm">
          <span>
            Showing now: <strong>{popupLabel(popup)}</strong>
          </span>
          <Button size="sm" variant="secondary" onClick={onClear}>
            Take it down
          </Button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles
          .filter((t) => t.show)
          .map((t) => (
            <motion.button key={t.label} type="button" whileTap={{ scale: 0.93 }} whileHover={{ y: -2 }} onClick={() => onSend(t.popup())} className="flex min-h-28 flex-col justify-between rounded-3xl border border-line bg-surface p-4 text-left hover:border-accent-line">
              <span className="text-2xl" aria-hidden>
                {t.icon}
              </span>
              <span>
                <span className="block font-semibold">{t.label}</span>
                <span className="text-xs text-faint">{t.hint}</span>
              </span>
            </motion.button>
          ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) onSend({ id: popupId(), kind: "message", title: title.trim(), text: text.trim() || undefined });
        }}
        className="space-y-2 rounded-3xl border border-line p-4"
      >
        <p className="font-semibold">A note</p>
        <input className={input} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Your print will be ready Friday!" />
        <input className={input} value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="More details (optional)" />
        <Button type="submit" variant="secondary" className="w-full" disabled={!title.trim()}>
          Show it
        </Button>
      </form>
    </div>
  );
}

function popupLabel(p: PosPopup) {
  switch (p.kind) {
    case "email":
      return "Receipt email";
    case "account":
      return "Join rewards";
    case "card-link":
      return "Scan to pay";
    case "etransfer":
      return "e-Transfer details";
    case "qr":
    case "message":
      return p.title;
  }
}

function LinkPanel({ link, paid, hasDisplay, onShow }: { link: PayLink | null; paid: boolean; hasDisplay: boolean; onShow: () => void }) {
  if (!link) {
    return (
      <div className="grid place-items-center py-8 text-muted">
        <motion.span className="h-10 w-10 rounded-full border-4 border-line border-t-accent-text" animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
        <p className="mt-3 text-sm">Making the Square link...</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 text-center">
      <AnimatePresence mode="wait">
        {paid ? (
          <motion.div key="paid" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-4">
            <DrawnCheck className="mx-auto h-20 w-20 text-success" />
            <p className="mt-2 font-semibold">Paid! Ringing it up...</p>
          </motion.div>
        ) : (
          <motion.div key="qr" exit={{ opacity: 0 }}>
            <Qr value={link.url} className="mx-auto w-48" />
            <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted">
              <motion.span className="h-2 w-2 rounded-full bg-accent-text" animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
              {hasDisplay ? "Showing on the display. Waiting for payment." : "Waiting for payment."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      {!hasDisplay && !paid && (
        <Button variant="secondary" className="w-full" onClick={onShow}>
          Show the customer
        </Button>
      )}
      <p className="text-xs text-faint">Closing this cancels the link.</p>
    </div>
  );
}

/** Cash given, with quick amounts and the change to hand back. */
function CashTender({ totalCents, value, onChange }: { totalCents: number; value: string; onChange: (v: string) => void }) {
  const given = dollars(value);
  const change = given != null && !Number.isNaN(given) ? given - totalCents : null;
  const quick = [...new Set([totalCents, Math.ceil(totalCents / 500) * 500, Math.ceil(totalCents / 1000) * 1000, Math.ceil(totalCents / 2000) * 2000, Math.ceil(totalCents / 5000) * 5000, Math.ceil(totalCents / 10000) * 10000].filter((c) => c >= totalCents))].slice(0, 6);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {quick.map((c) => (
          <motion.button key={c} type="button" whileTap={{ scale: 0.92 }} onClick={() => onChange((c / 100).toFixed(2))} className={cn("rounded-2xl border py-3 font-semibold", given === c ? "border-accent-line bg-accent text-accent-ink" : "border-line bg-surface hover:border-line-strong")}>
            {c === totalCents ? "Exact" : money(c)}
          </motion.button>
        ))}
      </div>
      <input className={cn(input, "h-14 text-center text-2xl font-semibold")} inputMode="decimal" placeholder="Cash given" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Cash given" />
      <AnimatePresence>
        {change != null && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("flex items-baseline justify-between rounded-2xl p-4", change < 0 ? "bg-danger/10 text-danger" : "bg-success/10")}>
            <span className="font-semibold">{change < 0 ? "Still owed" : "Change"}</span>
            <AnimatedMoney cents={Math.abs(change)} className="font-display text-3xl font-bold" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PayFooter({ opts, setOpts, hasEmail }: { opts: { handedOver: boolean; printTicket: boolean; emailCustomer: boolean }; setOpts: (o: { handedOver: boolean; printTicket: boolean; emailCustomer: boolean }) => void; hasEmail: boolean }) {
  const chip = (on: boolean, label: string, flip: () => void, disabled = false) => (
    <button type="button" disabled={disabled} onClick={flip} className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-35", on && !disabled ? "border-accent-line bg-accent-soft text-fg" : "border-line text-muted")}>
      {on && !disabled ? "✓ " : ""}
      {label}
    </button>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {chip(opts.handedOver, "They take it now", () => setOpts({ ...opts, handedOver: !opts.handedOver }))}
      {chip(opts.printTicket, "Print ticket", () => setOpts({ ...opts, printTicket: !opts.printTicket }))}
      {chip(opts.emailCustomer, hasEmail ? "Email receipt" : "Email receipt (no email)", () => setOpts({ ...opts, emailCustomer: !opts.emailCustomer }), !hasEmail)}
    </div>
  );
}

function SaleDone({ done, onNew, onShowThanks }: { done: Done; onNew: () => void; onShowThanks: () => void }) {
  return (
    <div className="py-2 text-center">
      <DrawnCheck className="mx-auto h-20 w-20 text-success" />
      <p className="mt-3 font-display text-3xl font-bold">Sale complete</p>
      <p className="mt-1 text-muted">
        <Link href={`/admin/orders/${done.orderId}`} className="font-mono text-accent-text hover:underline">
          {done.orderNumber}
        </Link>
        {done.emailed && " · receipt emailed"}
      </p>
      {done.changeCents != null && (
        <motion.p initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, type: "spring" }} className="mt-5 rounded-2xl bg-success/10 p-4 text-3xl font-bold">
          Change <span className="font-mono">{money(done.changeCents)}</span>
        </motion.p>
      )}
      <div className="mt-6 flex flex-col gap-2">
        <Button size="lg" onClick={onNew} autoFocus>
          New sale
        </Button>
        <Button variant="ghost" onClick={onShowThanks}>
          Show thank you on this screen
        </Button>
      </div>
    </div>
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

function Row({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", good ? "text-success" : "text-muted")}>
      <span>{label}</span>
      <span className="break-all text-right font-mono">{value}</span>
    </div>
  );
}
