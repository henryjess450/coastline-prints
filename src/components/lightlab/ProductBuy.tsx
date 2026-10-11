"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { lightlab } from "@config/lightlab";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { useShopCart } from "@/lib/shop/cart";
import { inStock, unitPrice, variantOf, type ShopProductDto } from "@/lib/shop/types";
import { LampPlaceholder } from "./ProductGrid";
import { QuantityStepper } from "./QuantityStepper";

/** Photos, options, quantity and "Add to cart" for one product. */
export function ProductBuy({ product: p }: { product: ShopProductDto }) {
  // Start on the first option that's in stock.
  const [variantId, setVariantId] = useState<string | null>(() => p.variants.find((v) => inStock(p, v.id) !== 0)?.id ?? p.variants[0]?.id ?? null);
  const [qty, setQty] = useState(1);
  const [photo, setPhoto] = useState(0);
  const add = useShopCart((s) => s.add);
  const inCart = useShopCart((s) => s.lines.find((l) => l.productId === p.id && l.variantId === variantId)?.quantity ?? 0);
  const [added, setAdded] = useState(0);

  const variant = variantOf(p, variantId);
  const price = unitPrice(p, variantId);
  const left = inStock(p, variantId);
  const canAdd = left == null ? lightlab.maxQuantityPerLine - inCart : Math.min(left, lightlab.maxQuantityPerLine) - inCart;
  const soldOut = left === 0;
  const quantity = Math.max(1, Math.min(qty, canAdd));

  function addToCart() {
    if (canAdd <= 0) return;
    add({ productId: p.id, variantId, quantity, slug: p.slug, name: p.name, variantName: variant?.name ?? null, swatch: variant?.hex ?? null, image: p.images[0] ?? null, unitCents: price, max: left });
    setAdded((n) => n + 1);
    setQty(1);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
      <div className="min-w-0">
        <div className="relative aspect-square overflow-hidden rounded-3xl border border-line bg-surface">
          <AnimatePresence mode="popLayout" initial={false}>
            {p.images.length ? (
              <motion.img key={photo} src={p.images[photo]} alt={p.name} className="absolute inset-0 h-full w-full object-cover" initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} />
            ) : (
              <LampPlaceholder />
            )}
          </AnimatePresence>
        </div>
        {p.images.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {p.images.map((src, i) => (
              <button key={src} type="button" onClick={() => setPhoto(i)} aria-label={`Photo ${i + 1}`} aria-pressed={i === photo} className={cn("h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 transition-[border-color,transform] active:scale-95", i === photo ? "border-accent-line" : "border-transparent opacity-70 hover:opacity-100")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-w-0 lg:pt-4">
        {p.category && <p className="ll-accent text-2xl">{p.category}</p>}
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{p.name}</h1>
        {p.tagline && <p className="ll-accent mt-2 text-3xl">{p.tagline}</p>}
        <p className="mt-5 flex items-baseline gap-3">
          <motion.span key={price} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-display text-3xl font-bold tabular-nums">
            {money(price)}
          </motion.span>
          {p.compareAtCents && p.compareAtCents > price && <span className="font-mono text-faint line-through">{money(p.compareAtCents)}</span>}
        </p>

        {p.variants.length > 0 && (
          <fieldset className="mt-8">
            <legend className="mb-3 text-sm font-medium">
              Option{variant && <span className="font-normal text-muted">: {variant.name}</span>}
            </legend>
            <div className="flex flex-wrap gap-2">
              {p.variants.map((v) => {
                const on = v.id === variantId;
                const out = inStock(p, v.id) === 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariantId(v.id)}
                    aria-pressed={on}
                    className={cn("relative inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-[border-color,transform] active:scale-95", on ? "border-accent-line" : "border-line hover:border-accent-line", out && "text-faint line-through")}
                  >
                    {on && <motion.span layoutId={`ll-variant-${p.id}`} className="absolute -inset-px rounded-full border-2 border-accent-line bg-accent-soft" transition={{ type: "spring", stiffness: 460, damping: 34 }} />}
                    {v.hex && <span className="relative h-4 w-4 rounded-full border border-line-strong" style={{ background: v.hex }} aria-hidden />}
                    <span className="relative">{v.name}</span>
                    {v.priceCents != null && v.priceCents !== p.priceCents && <span className="relative font-mono text-xs text-muted">{money(v.priceCents)}</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <p className={cn("mt-6 text-sm", soldOut ? "text-danger" : left != null && left <= 3 ? "text-warning" : "text-success")}>
          {soldOut ? "Sold out" : left == null ? "Made to order" : left <= 3 ? `Only ${left} left` : "In stock"}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!soldOut && canAdd > 0 && <QuantityStepper value={quantity} max={canAdd} onChange={setQty} />}
          <Button size="lg" className="min-w-48 flex-1 sm:flex-none" onClick={addToCart} disabled={soldOut || canAdd <= 0}>
            {soldOut ? "Sold out" : canAdd <= 0 ? "All in your cart" : `Add to cart · ${money(price * quantity)}`}
          </Button>
        </div>
        <AnimatePresence>
          {added > 0 && (
            <motion.p key={added} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-sm text-success" role="status">
              Added to your cart.
            </motion.p>
          )}
        </AnimatePresence>

        {p.description && <div className="mt-10 whitespace-pre-line border-t border-line pt-8 leading-relaxed text-muted">{p.description}</div>}

        <ul className="mt-8 space-y-2 border-t border-line pt-6 text-sm text-muted">
          <li>Free pickup, or Canada Post shipping anywhere in Canada.</li>
          <li>Pay by Interac e-Transfer or card. Coastline gift cards work too.</li>
        </ul>
      </div>
    </div>
  );
}
