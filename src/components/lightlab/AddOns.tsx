"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { ShopId } from "@config/shops";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { cartFor } from "@/lib/shop/cart";
import { inStock, photosFor, unitPrice, type ShopProductDto, type ShopVariant } from "@/lib/shop/types";

/**
 * One-tap extras (spare bulbs, a smart bulb, an inline switch), set up in the
 * admin as add-on products. Tap to add, tap again to take it out; add-ons with
 * options show each option as its own little button. Shown in the cart drawer
 * and at checkout. `products` can be passed in, else they're fetched.
 */
export function AddOns({ shop, products, closeOnAdd = false, className }: { shop: ShopId; products?: ShopProductDto[]; /** At checkout: don't pop the cart drawer open. */ closeOnAdd?: boolean; className?: string }) {
  const useCart = cartFor(shop);
  const lines = useCart((s) => s.lines);
  const add = useCart((s) => s.add);
  const remove = useCart((s) => s.remove);
  const setOpen = useCart((s) => s.setOpen);
  const [fetched, setFetched] = useState<ShopProductDto[] | null>(null);
  useEffect(() => {
    if (products) return;
    let live = true;
    fetch(`/api/shop/addons?shop=${shop}`)
      .then((r) => (r.ok ? r.json() : { addons: [] }))
      .then((d: { addons: ShopProductDto[] }) => live && setFetched(d.addons))
      .catch(() => live && setFetched([]));
    return () => {
      live = false;
    };
  }, [products, shop]);
  const addons = (products ?? fetched ?? []).filter((p) => p.addon && !p.personalize);
  // Each add-on, or each of its options, that can still be bought.
  const choices = addons
    .flatMap((p): { p: ShopProductDto; v: ShopVariant | null }[] => (p.variants.length ? p.variants.map((v) => ({ p, v })) : [{ p, v: null }]))
    .filter(({ p, v }) => inStock(p, v?.id ?? null) !== 0);
  if (!choices.length || !lines.some((l) => !addons.some((a) => a.id === l.productId))) return null;

  return (
    <section aria-labelledby={`addons-${shop}`} className={cn("rounded-2xl border border-line bg-surface p-4", className)}>
      <h2 id={`addons-${shop}`} className="text-sm font-semibold">
        Add to your order
      </h2>
      <ul className="mt-3 space-y-2">
        <AnimatePresence initial={false}>
          {choices.map(({ p, v }) => {
            const key = `${p.id}:${v?.id ?? ""}`;
            const line = lines.find((l) => l.productId === p.id && l.variantId === (v?.id ?? null));
            const price = unitPrice(p, v?.id ?? null);
            const image = photosFor(p, v?.id ?? null).images[0] ?? null;
            return (
              <motion.li key={key} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3">
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-line bg-bg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : v?.hex ? <span className="block h-full w-full" style={{ background: v.hex }} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {p.name}
                    {v && <span className="font-normal text-muted"> · {v.name}</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">{p.tagline || money(price)}</span>
                </span>
                <button
                  type="button"
                  aria-pressed={!!line}
                  onClick={() => {
                    if (line) return remove(line.key);
                    add({ productId: p.id, variantId: v?.id ?? null, quantity: 1, customText: null, slug: p.slug, name: p.name, variantName: v?.name ?? null, swatch: v?.hex ?? null, image, unitCents: price, max: inStock(p, v?.id ?? null) });
                    if (closeOnAdd) setOpen(false);
                  }}
                  className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-[background-color,color,transform] active:scale-95", line ? "border-transparent bg-accent text-accent-ink" : "border-line hover:border-accent-line")}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span key={line ? "on" : "off"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
                      {line ? "Added ✓" : `+ ${money(price)}`}
                    </motion.span>
                  </AnimatePresence>
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </section>
  );
}
