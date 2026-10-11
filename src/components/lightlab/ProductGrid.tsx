"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { inStock, type ShopProductDto } from "@/lib/shop/types";

/** Everything left to buy across a product's options. Null = made to order. */
function stockLeft(p: ShopProductDto) {
  if (!p.variants.length) return inStock(p, null);
  let total = 0;
  for (const v of p.variants) {
    const n = inStock(p, v.id);
    if (n == null) return null;
    total += n;
  }
  return total;
}

const fromPrice = (p: ShopProductDto) => Math.min(p.priceCents, ...p.variants.map((v) => v.priceCents ?? p.priceCents));

export function ProductGrid({ products }: { products: ShopProductDto[] }) {
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
  const [cat, setCat] = useState<string | null>(null);
  const shown = cat ? products.filter((p) => p.category === cat) : products;

  return (
    <div>
      {categories.length > 1 && (
        <div role="tablist" aria-label="Categories" className="mb-8 flex flex-wrap gap-2">
          {[null, ...categories].map((c) => {
            const on = cat === c;
            return (
              <button key={c ?? "all"} type="button" role="tab" aria-selected={on} onClick={() => setCat(c)} className={cn("relative rounded-full border px-4 py-1.5 text-sm font-medium transition-colors active:scale-95", on ? "border-transparent text-accent-ink" : "border-line text-muted hover:text-fg")}>
                {on && <motion.span layoutId="ll-cat" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 480, damping: 36 }} />}
                <span className="relative">{c ?? "All"}</span>
              </button>
            );
          })}
        </div>
      )}
      <motion.ul layout className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {shown.map((p, i) => (
            <motion.li key={p.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.04 }}>
              <ProductCard product={p} />
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
    </div>
  );
}

function ProductCard({ product: p }: { product: ShopProductDto }) {
  const left = stockLeft(p);
  const soldOut = left === 0;
  const price = fromPrice(p);
  return (
    <Link href={`/lightlab/${p.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-3xl border border-line bg-surface">
        {p.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.images[0]} alt={p.name} loading="lazy" className={cn("h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]", soldOut && "opacity-60")} />
        ) : (
          <LampPlaceholder />
        )}
        {/* Second photo fades in on hover, like turning the piece around */}
        {p.images[1] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.images[1]} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {soldOut ? (
            <Badge>Sold out</Badge>
          ) : left != null && left <= 3 ? (
            <Badge>Only {left} left</Badge>
          ) : p.compareAtCents && p.compareAtCents > p.priceCents ? (
            <Badge solid>On sale</Badge>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display font-semibold leading-snug transition-colors group-hover:text-accent-text">{p.name}</p>
          {p.tagline && <p className="ll-accent mt-1 line-clamp-2 text-xl">{p.tagline}</p>}
        </div>
        <p className="shrink-0 text-right font-mono text-sm">
          {p.variants.some((v) => v.priceCents != null && v.priceCents !== p.priceCents) && <span className="text-faint">from </span>}
          {money(price)}
          {p.compareAtCents && p.compareAtCents > price && <span className="block text-xs text-faint line-through">{money(p.compareAtCents)}</span>}
        </p>
      </div>
      {p.variants.some((v) => v.hex) && (
        <div className="mt-2 flex gap-1" aria-hidden>
          {p.variants
            .filter((v) => v.hex)
            .slice(0, 6)
            .map((v) => (
              <span key={v.id} className="h-3.5 w-3.5 rounded-full border border-line-strong" style={{ background: v.hex! }} />
            ))}
        </div>
      )}
    </Link>
  );
}

function Badge({ children, solid }: { children: React.ReactNode; /** Filled (black or white) instead of quiet. */ solid?: boolean }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", solid ? "bg-accent text-accent-ink" : "bg-bg/85 text-fg backdrop-blur")}>
      {children}
    </span>
  );
}

/** Until the owner adds photos: a simple pendant lamp, black and white. */
export function LampPlaceholder() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full text-fg" aria-hidden>
      <line x1="50" y1="0" x2="50" y2="34" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <path d="M32 52 Q50 26 68 52 Z" fill="currentColor" />
      <circle cx="50" cy="55" r="4" fill="var(--bg)" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
