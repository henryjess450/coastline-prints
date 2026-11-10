"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { shopConfig, type ShopId } from "@config/shops";
import { buttonClass } from "@/components/ui/Button";
import { money } from "@/lib/format";
import { cartFor, useShopCartHydrated } from "@/lib/shop/cart";
import { AddOns } from "./AddOns";
import { QuantityStepper } from "./QuantityStepper";
import { RollingNumber } from "./RollingNumber";
import { TinyLamp } from "./TinyLamp";
import type { ShopCartLine } from "@/lib/shop/cart";

/** The cart in the header on a shop's pages (LightLab, or the Coastline shop), and the drawer it opens. */
export function CartButton({ shop = "lightlab" }: { shop?: ShopId }) {
  const useCart = cartFor(shop);
  const hydrated = useShopCartHydrated(shop);
  const lines = useCart((s) => s.lines);
  const open = useCart((s) => s.open);
  const setOpen = useCart((s) => s.setOpen);
  const count = hydrated ? lines.reduce((n, l) => n + l.quantity, 0) : 0;
  const pathname = usePathname();

  // Close when moving to another page (e.g. checkout).
  useEffect(() => setOpen(false), [pathname, setOpen]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <>
      <button type="button" data-cart-button onClick={() => setOpen(true)} aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`} className={buttonClass("secondary", "sm", "relative w-10 px-0")}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
        <AnimatePresence>
          {count > 0 && (
            <motion.span
              key="count"
              initial={{ scale: 0.4 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 18 }}
              className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-ink"
            >
              <RollingNumber value={count} />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Your cart">
            <motion.button type="button" aria-label="Close cart" className="absolute inset-0 cursor-default bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside
              className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-line bg-bg pt-[env(safe-area-inset-top)]"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
            >
              <CartContents shop={shop} onClose={() => setOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function CartContents({ shop, onClose }: { shop: ShopId; onClose: () => void }) {
  const useCart = cartFor(shop);
  const { base, maxQuantityPerLine } = shopConfig(shop);
  const lines = useCart((s) => s.lines);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const restore = useCart((s) => s.restore);
  // The last thing taken out, for "Undo" (gone after a few seconds).
  const [removed, setRemoved] = useState<{ line: ShopCartLine; index: number } | null>(null);
  useEffect(() => {
    if (!removed) return;
    const t = setTimeout(() => setRemoved(null), 5000);
    return () => clearTimeout(t);
  }, [removed]);
  const takeOut = (l: ShopCartLine) => {
    setRemoved({ line: l, index: lines.findIndex((x) => x.key === l.key) });
    remove(l.key);
  };
  const subtotal = lines.reduce((s, l) => s + l.unitCents * l.quantity, 0);

  return (
    <>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-display text-lg font-semibold">Your cart</h2>
        <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-strong hover:text-fg" aria-label="Close cart">
          ✕
        </button>
      </div>
      <AnimatePresence>
        {removed && (
          <motion.div key="undo" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-line bg-surface">
            <div className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm" role="status">
              <span className="truncate text-muted">Removed {removed.line.name}</span>
              <button type="button" onClick={() => (restore(removed.line, removed.index), setRemoved(null))} className="shrink-0 font-semibold text-accent-text underline-offset-4 hover:underline">
                Undo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {lines.length === 0 ? (
        <div className="grid flex-1 place-items-center px-6 text-center">
          <div className="flex flex-col items-center">
            <span className="mb-3 text-faint">
              <TinyLamp on={false} size={56} />
            </span>
            <p className="font-medium">Your cart is empty.</p>
            <button type="button" onClick={onClose} className="mt-3 text-sm text-accent-text underline underline-offset-4">
              Keep browsing
            </button>
          </div>
        </div>
      ) : (
        <>
          <ul className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <AnimatePresence initial={false}>
              {lines.map((l) => (
                <motion.li key={l.key} layout initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 80, height: 0, marginTop: 0, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }} className="flex gap-3">
                  <Link href={`${base}/${l.slug}`} onClick={onClose} className="shrink-0">
                    {l.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.image} alt="" className="h-20 w-20 rounded-2xl border border-line object-cover" />
                    ) : (
                      <span className="block h-20 w-20 rounded-2xl border border-line bg-surface-strong" style={l.swatch ? { background: l.swatch } : undefined} />
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{l.name}</p>
                        {l.variantName && <p className="text-xs text-muted">{l.variantName}</p>}
                        {l.customText && <p className="truncate text-xs text-muted">&ldquo;{l.customText}&rdquo;</p>}
                      </div>
                      <span className="shrink-0 font-mono text-sm">{money(l.unitCents * l.quantity)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <QuantityStepper value={l.quantity} max={Math.min(maxQuantityPerLine, l.max ?? Infinity)} onChange={(q) => setQuantity(l.key, q)} size="sm" />
                      <button type="button" onClick={() => takeOut(l)} className="text-xs text-muted underline-offset-4 hover:text-danger hover:underline">
                        Remove
                      </button>
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
            <li>
              <AddOns shop={shop} />
            </li>
          </ul>
          <div className="border-t border-line px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
            <div className="flex items-baseline justify-between">
              <span className="flex items-center gap-2 text-sm text-muted">
                <TinyLamp on size={28} />
                Subtotal
              </span>
              <span className="font-display text-2xl font-bold tabular-nums">{money(subtotal)}</span>
            </div>
            <p className="mt-1 text-xs text-faint">Pickup is free. Codes and any shipping are added at checkout.</p>
            <Link href={`${base}/checkout`} className={buttonClass("primary", "lg", "mt-4 w-full")}>
              Checkout
            </Link>
          </div>
        </>
      )}
    </>
  );
}
