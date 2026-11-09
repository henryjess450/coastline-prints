"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { LightLabLogo } from "@/components/lightlab/LightLabLogo";
import { FadeImg } from "@/components/lightlab/FadeImg";
import { Gallery } from "@/components/lightlab/Gallery";
import { QuantityStepper } from "@/components/lightlab/QuantityStepper";
import { RollingNumber } from "@/components/lightlab/RollingNumber";
import { TinyLamp } from "@/components/lightlab/TinyLamp";
import { flyToCart } from "@/lib/feel/fly";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import type { PosQuote } from "@/lib/pos/types";
import { CUSTOM_TEXT_MAX, inStock, unitPrice, type ShopProductDto } from "@/lib/shop/types";
import { addLine, type KioskLine } from "./kiosk-cart";
import { Steps, type KioskMode } from "./KioskBits";

/** Everything left across a product's options (null = made to order). */
function left(p: ShopProductDto) {
  if (!p.variants.length) return inStock(p, null);
  let n = 0;
  for (const v of p.variants) {
    const s = inStock(p, v.id);
    if (s == null) return null;
    n += s;
  }
  return n;
}

/**
 * The kiosk's shop: big lamp tiles on the left, the bag on the right. In an
 * order-only kiosk nothing is "sold out" (it's all made to order) and the
 * button goes on to the order details instead of paying.
 */
export function KioskShop({
  mode,
  products,
  lines,
  setLines,
  codes,
  setCodes,
  quote,
  total,
  onNext,
  onStartOver,
  feedback,
}: {
  mode: KioskMode;
  products: ShopProductDto[];
  lines: KioskLine[];
  setLines: (f: (l: KioskLine[]) => KioskLine[]) => void;
  codes: string[];
  setCodes: (c: string[]) => void;
  quote: PosQuote | null;
  total: number;
  onNext: () => void;
  onStartOver: () => void;
  feedback: (kind: "click" | "pop" | "chime" | "sparkle", buzzMs?: number) => void;
}) {
  const order = mode === "order";
  const [open, setOpen] = useState<ShopProductDto | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
  const shown = cat ? products.filter((p) => p.category === cat) : products;
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const problem = quote && !quote.ok ? quote.error : null;
  // An empty bag for a few seconds: the first lamp gently waves to say "tap me".
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (count) return;
    const t = setTimeout(() => setHint(true), 6000);
    return () => {
      clearTimeout(t);
      setHint(false);
    };
  }, [count]);

  return (
    <div className="flex h-full">
      {/* Lamps */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <div className="flex items-center gap-4">
            <LightLabLogo className="h-10" />
            <Steps mode={mode} at={0} />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onStartOver} className="h-11 rounded-full border border-line px-5 text-sm font-semibold text-muted">
              Start over
            </button>
          </div>
        </header>
        {cats.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-6 pt-4 [scrollbar-width:none]">
            {[null, ...cats].map((c) => (
              <button key={c ?? "all"} type="button" onClick={() => (setCat(c), feedback("click"))} className={cn("relative shrink-0 rounded-full border px-5 py-2.5 text-base font-medium transition-transform active:scale-95", cat === c ? "border-transparent text-accent-ink" : "border-line text-muted")}>
                {cat === c && <motion.span layoutId="kiosk-cat" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 480, damping: 36 }} />}
                <span className="relative">{c ?? "All lamps"}</span>
              </button>
            ))}
          </div>
        )}
        <motion.ul layout className="grid flex-1 auto-rows-max grid-cols-2 gap-5 overflow-y-auto p-6 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {shown.map((p, i) => {
              const n = left(p);
              const out = !order && n === 0;
              const from = Math.min(p.priceCents, ...p.variants.map((v) => v.priceCents ?? p.priceCents));
              return (
                <motion.li key={p.id} layout initial={{ opacity: 0, y: 24, rotate: -1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ type: "spring", stiffness: 300, damping: 24, delay: Math.min(i, 9) * 0.05 }}>
                  <motion.button
                    type="button"
                    disabled={out}
                    onClick={() => (setOpen(p), feedback("click"))}
                    whileTap={{ scale: 0.95, rotate: i % 2 ? 1 : -1 }}
                    animate={hint && i === 0 ? { rotate: [0, -2.5, 2.5, -1.5, 0] } : { rotate: 0 }}
                    transition={hint && i === 0 ? { duration: 1.1, repeat: Infinity, repeatDelay: 2.4 } : { duration: 0.2 }}
                    className="group block w-full text-left disabled:opacity-50"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-3xl border border-line bg-surface">
                      {p.images[0] && <FadeImg src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />}
                      {!order && (out || (n != null && n <= 3)) && <span className="ll-flicker absolute left-3 top-3 rounded-full bg-bg/85 px-3 py-1 text-sm font-semibold backdrop-blur">{out ? "Sold out" : `Only ${n} left`}</span>}
                      {order && p.personalize && <span className="absolute left-3 top-3 rounded-full bg-bg/85 px-3 py-1 text-sm font-semibold backdrop-blur">Add a name</span>}
                      {hint && i === 0 && (
                        <motion.span className="absolute bottom-3 right-3 rounded-full bg-fg px-4 py-2 text-sm font-bold text-bg" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                          Tap me!
                        </motion.span>
                      )}
                    </div>
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <p className="font-display text-xl font-semibold leading-tight">{p.name}</p>
                      <p className="shrink-0 font-mono text-lg">{money(from)}</p>
                    </div>
                  </motion.button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      </div>

      {/* Bag */}
      <aside className="flex w-[360px] shrink-0 flex-col border-l border-line bg-surface xl:w-[400px]">
        <div className="flex items-center justify-between px-6 pb-3 pt-5">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
            <TinyLamp on={count > 0} size={30} />
            {order ? "Your order" : "Your bag"}
          </h2>
          <span data-cart-button className="inline-flex items-center gap-1 rounded-full bg-bg px-3 py-1 text-muted">
            <RollingNumber value={count} /> {count === 1 ? "item" : "items"}
          </span>
        </div>
        <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6">
          <AnimatePresence initial={false}>
            {lines.map((l) => (
              <motion.li key={l.key} layout initial={{ opacity: 0, x: 40, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 80, height: 0, marginTop: 0 }} transition={{ type: "spring", stiffness: 380, damping: 28 }} className="flex gap-3 rounded-2xl bg-bg p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.image ? <img src={l.image} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <span className="h-16 w-16 shrink-0 rounded-xl bg-elev" />}
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <p className="truncate font-semibold">{l.name}</p>
                    <p className="font-mono">{money(l.unitCents * l.quantity)}</p>
                  </div>
                  {(l.variantName || l.customText) && <p className="truncate text-sm text-muted">{[l.variantName, l.customText && `“${l.customText}”`].filter(Boolean).join(" · ")}</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <QuantityStepper value={l.quantity} max={Math.min(20, order ? 20 : (l.max ?? 20))} onChange={(q) => (setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, quantity: q } : x))), feedback("click"))} size="sm" />
                    <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="px-2 py-1 text-sm text-muted">
                      Remove
                    </button>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
          {!lines.length && (
            <li className="flex flex-col items-center py-14 text-center text-muted">
              <span className="text-faint">
                <TinyLamp on={false} size={64} />
              </span>
              <p className="mt-3">Tap a lamp to add it.</p>
              <p className="text-sm text-faint">The lamp up top lights when you do.</p>
            </li>
          )}
        </ul>
        <div className="border-t border-line px-6 pb-6 pt-4">
          <CodeEntry codes={codes} setCodes={setCodes} quote={quote} />
          {quote?.discounts.map((d) => (
              <motion.p key={d.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mt-2 flex justify-between text-sm text-success">
                <span>{d.label}</span>
                <span className="font-mono">−{money(d.cents)}</span>
              </motion.p>
            ))}
          <CardFeeRow quote={quote} />
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-muted">Total</span>
            <motion.span key={total} initial={{ y: -8, opacity: 0, scale: 1.08 }} animate={{ y: 0, opacity: 1, scale: 1 }} className="font-display text-3xl font-bold tabular-nums">
              {money(total)}
            </motion.span>
          </div>
          {problem && <p className="mt-2 text-sm text-danger">{problem}</p>}
          <motion.button
            type="button"
            disabled={!lines.length || !!problem || !quote}
            onClick={() => (feedback("click"), onNext())}
            whileTap={{ scale: 0.97 }}
            animate={lines.length ? { boxShadow: ["0 0 0 0 rgb(41 127 157 / 0)", "0 0 0 10px rgb(41 127 157 / 0.18)", "0 0 0 0 rgb(41 127 157 / 0)"] } : { boxShadow: "0 0 0 0 rgb(41 127 157 / 0)" }}
            transition={lines.length ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : undefined}
            className="mt-4 h-16 w-full rounded-full bg-fg text-lg font-bold text-bg disabled:opacity-40"
          >
            {order ? "Next: your details" : lines.length ? `Pay ${money(total)}` : "Pay"}
          </motion.button>
          <p className="mt-2 text-center text-xs text-faint">{order ? "Made for you by the day you pick. Pay on your phone." : "On your phone: card, Apple Pay or Google Pay"}</p>
        </div>
      </aside>

      <AnimatePresence>
        {open && (
          <ProductSheet
            key={open.id}
            p={open}
            order={order}
            onClose={() => setOpen(null)}
            onAdd={(variantId, qty, price, max, customText, from) => {
              const p = open;
              setOpen(null);
              feedback("pop", 15);
              // The photo flies into the bag, then it lands (and the bag lamp lights).
              flyToCart(from, p.images[0] ?? null, () => {
                setLines((ls) => addLine(ls, p, variantId, qty, price, order ? null : max, customText));
                feedback("sparkle");
              });
            }}
            inBag={(variantId) => lines.filter((l) => l.productId === open.id && l.variantId === variantId).reduce((n, l) => n + l.quantity, 0)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** One lamp, big: photos (swipe), options, a name for personalised ones, how many, and Add. */
function ProductSheet({ p, order, onClose, onAdd, inBag }: { p: ShopProductDto; order: boolean; onClose: () => void; onAdd: (variantId: string | null, qty: number, unitCents: number, max: number | null, customText: string, from: Element | null) => void; inBag: (variantId: string | null) => number }) {
  const [variantId, setVariantId] = useState<string | null>(() => (order ? p.variants[0]?.id : p.variants.find((v) => inStock(p, v.id) !== 0)?.id ?? p.variants[0]?.id) ?? null);
  const [qty, setQty] = useState(1);
  const [text, setText] = useState("");
  const [needText, setNeedText] = useState(false);
  const photo = useRef<HTMLDivElement>(null);
  const variant = p.variants.find((v) => v.id === variantId) ?? null;
  const price = unitPrice(p, variantId);
  const stock = order ? null : inStock(p, variantId);
  const room = Math.min(20, stock ?? 20) - (order ? 0 : inBag(variantId));
  const quantity = Math.max(1, Math.min(qty, room));
  const personal = order && !!p.personalize;

  return (
    <motion.div className="fixed inset-0 z-[300] flex items-center justify-center p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <motion.div role="dialog" aria-modal aria-label={p.name} className="relative grid max-h-full w-full max-w-5xl grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8 overflow-y-auto rounded-[32px] border border-line bg-elev p-8" initial={{ y: 60, scale: 0.92, rotate: -1 }} animate={{ y: 0, scale: 1, rotate: 0 }} exit={{ y: 30, opacity: 0, scale: 0.96 }} transition={{ type: "spring", stiffness: 340, damping: 26 }}>
        <div ref={photo}>
          <Gallery images={p.images} name={p.name} shop="lightlab" glow={variant?.hex ?? null} tag={personal ? text.trim() || null : null} />
        </div>
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-4">
            <div>
              {p.category && <p className="ll-accent text-2xl">{p.category}</p>}
              <h2 className="font-display text-4xl font-bold leading-tight">{p.name}</h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface text-xl text-muted">
              ✕
            </button>
          </div>
          {p.tagline && <p className="ll-accent mt-2 text-3xl">{p.tagline}</p>}
          <motion.p key={price} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mt-4 font-display text-3xl font-bold tabular-nums">
            {money(price)}
          </motion.p>
          {p.variants.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              {p.variants.map((v) => {
                const out = !order && inStock(p, v.id) === 0;
                const on = v.id === variantId;
                return (
                  <motion.button key={v.id} type="button" disabled={out} whileTap={{ scale: 0.92 }} onClick={() => (setVariantId(v.id), setQty(1))} className={cn("relative inline-flex items-center gap-2 rounded-full border px-5 py-3 text-lg", on ? "border-accent-line" : "border-line", out && "text-faint line-through")}>
                    {on && <motion.span layoutId={`kiosk-v-${p.id}`} className="absolute -inset-px rounded-full border-2 border-accent-line bg-accent-soft" transition={{ type: "spring", stiffness: 460, damping: 30 }} />}
                    {v.hex && <motion.span className="relative h-5 w-5 rounded-full border border-line-strong" style={{ background: v.hex }} animate={on ? { scale: [1, 1.35, 1] } : { scale: 1 }} transition={{ duration: 0.4 }} />}
                    <span className="relative">{v.name}</span>
                  </motion.button>
                );
              })}
            </div>
          )}
          {personal && (
            <div className="mt-6">
              <label htmlFor="kiosk-custom" className="mb-2 block text-lg font-medium">
                {p.personalize}
              </label>
              <input id="kiosk-custom" value={text} maxLength={CUSTOM_TEXT_MAX} onChange={(e) => (setText(e.target.value), setNeedText(false))} autoComplete="off" className={cn("h-14 w-full rounded-2xl border bg-surface px-4 text-xl outline-none focus:border-accent-line", needText ? "border-danger" : "border-line")} />
              <p className={cn("mt-1 text-sm", needText ? "text-danger" : "text-faint")}>{needText ? "Please fill this in first." : "Watch it appear on the tag!"}</p>
            </div>
          )}
          {p.description && <p className="mt-6 line-clamp-5 whitespace-pre-line text-lg leading-relaxed text-muted">{p.description}</p>}
          <div className="mt-auto flex items-center gap-4 pt-8">
            {room > 0 && <QuantityStepper value={quantity} max={room} onChange={setQty} />}
            <motion.button
              type="button"
              disabled={room <= 0}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                if (personal && !text.trim()) return setNeedText(true);
                onAdd(variantId, quantity, price, stock, personal ? text.trim() : "", photo.current);
              }}
              className="h-16 flex-1 rounded-full bg-fg text-lg font-bold text-bg disabled:opacity-40"
            >
              {room <= 0 ? "All in your bag" : `${order ? "Add to order" : "Add to bag"} · ${money(price * quantity)}`}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** "Got a thank-you card?" Type its number (or scan it, if the tablet has a scanner). */
function CodeEntry({ codes, setCodes, quote }: { codes: string[]; setCodes: (c: string[]) => void; quote: PosQuote | null }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const rejected = quote?.rejected.find((r) => codes.includes(r.code));
  if (!open && !codes.length)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-accent-text underline underline-offset-4">
        Have a thank-you card or coupon?
      </button>
    );
  return (
    <div>
      {codes.length > 0 ? (
        <p className="flex items-center justify-between text-sm">
          <span className="font-mono">{codes[0]}</span>
          <button type="button" onClick={() => setCodes([])} className="text-muted">
            Remove
          </button>
        </p>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            // A scanned card's QR types its whole link: keep just the code.
            const code = value.trim().match(/[?&]code=(\d{8,16})/)?.[1] ?? value.replace(/\s/g, "");
            if (code) setCodes([code]);
            setValue("");
          }}
        >
          <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric" placeholder="Card number" className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 font-mono outline-none focus:border-accent-line" />
          <button type="submit" className="h-12 rounded-xl bg-fg px-4 font-semibold text-bg">
            Apply
          </button>
        </form>
      )}
      {rejected && <p className="mt-1 text-sm text-danger">{rejected.reason}</p>}
    </div>
  );
}

/** The card processing fee as its own line, with a tap-to-see "why". */
export function CardFeeRow({ quote }: { quote: PosQuote | null }) {
  const [why, setWhy] = useState(false);
  const fee = quote?.lines.find((l) => l.key === "card-fee");
  if (!fee?.cents) return null;
  return (
    <div className="mt-2 text-sm">
      <p className="flex items-center justify-between gap-2 text-muted">
        <button type="button" onClick={() => setWhy((w) => !w)} className="flex items-center gap-1.5 text-left">
          {fee.name}
          <span className="grid h-5 w-5 place-items-center rounded-full border border-line text-[11px] font-bold">?</span>
        </button>
        <span className="font-mono">{money(fee.cents)}</span>
      </p>
      <AnimatePresence initial={false}>
        {why && (
          <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden text-xs text-faint">
            {fee.detail}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
