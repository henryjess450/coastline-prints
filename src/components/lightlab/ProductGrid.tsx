"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { shopConfig, type ShopId } from "@config/shops";
import { money } from "@/lib/format";
import { inSeason, inStock, SEASON_FILTER, slugify, type ShopProductDto } from "@/lib/shop/types";
import { useSeason } from "@/components/season/SeasonContext";
import { SeasonSparkle } from "./SeasonSparkle";

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

export function ProductGrid({ products, initialCategory = null }: { products: ShopProductDto[]; initialCategory?: string | null }) {
  const season = useSeason();
  const seasonal = products.filter((p) => inSeason(p, season.id));
  const seasonKey = `${SEASON_FILTER}${season.id}`;
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
  // This holiday's pieces get their own pill, first after All.
  const pills: (string | null)[] = [null, ...(seasonal.length ? [seasonKey] : []), ...categories];
  const [cat, setCatState] = useState<string | null>(initialCategory);
  const shown = !cat ? products : cat.startsWith(SEASON_FILTER) ? products.filter((p) => p.seasons.includes(cat.slice(SEASON_FILTER.length))) : products.filter((p) => p.category === cat);
  const lightlab = products[0]?.shop === "lightlab";

  // Keep ?collection= in the address bar so whatever's showing can be copied and shared.
  function setCat(c: string | null) {
    setCatState(c);
    const url = new URL(window.location.href);
    if (c) url.searchParams.set("collection", c.startsWith(SEASON_FILTER) ? c.slice(SEASON_FILTER.length) : slugify(c));
    else url.searchParams.delete("collection");
    window.history.replaceState(window.history.state, "", url);
  }
  const label = (c: string | null) => (c == null ? "All" : c === seasonKey ? `${season.name} ✦` : c.startsWith(SEASON_FILTER) ? c.slice(SEASON_FILTER.length) : c);

  return (
    <div>
      {/* While a holiday theme is on, its pieces get a shelf of their own above everything. */}
      {seasonal.length > 0 && !cat && (
        <section aria-label={`For ${season.name}`} className="mb-12 rounded-3xl border border-accent-line/40 bg-accent-soft p-5 sm:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className={lightlab ? "ll-accent text-2xl" : "text-xs font-semibold uppercase tracking-wider text-accent-text"}>just in time</p>
              <h3 className="mt-1 font-display text-2xl font-bold tracking-tight">For {season.name}</h3>
            </div>
            {seasonal.length > 3 && (
              <button type="button" onClick={() => setCat(seasonKey)} className="text-sm text-accent-text underline underline-offset-4">
                See all {seasonal.length}
              </button>
            )}
          </div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-3">
            {seasonal.slice(0, 3).map((p) => (
              <li key={p.id}>
                <ProductCard product={p} seasonId={season.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {(pills.length > 2 || cat) && (
        <div role="tablist" aria-label="Categories" className="mb-8 flex flex-wrap gap-2">
          {pills.map((c) => {
            const on = cat === c;
            return (
              <button key={c ?? "all"} type="button" role="tab" aria-selected={on} onClick={() => setCat(c)} className={cn("relative rounded-full border px-4 py-1.5 text-sm font-medium transition-colors active:scale-95", on ? "border-transparent text-accent-ink" : "border-line text-muted hover:text-fg")}>
                {on && <motion.span layoutId="ll-cat" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 480, damping: 36 }} />}
                <span className="relative">{label(c)}</span>
              </button>
            );
          })}
        </div>
      )}
      <motion.ul layout className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {shown.map((p, i) => (
            <motion.li key={p.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.04 }}>
              <ProductCard product={p} seasonId={season.id} />
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
    </div>
  );
}

/** Product cards on their own, for "You might also like" and the cart's suggestions. */
export function ProductCards({ products }: { products: ShopProductDto[] }) {
  const season = useSeason();
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3">
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} seasonId={season.id} />
        </li>
      ))}
    </ul>
  );
}

function ProductCard({ product: p, seasonId }: { product: ShopProductDto; seasonId: string }) {
  const festive = inSeason(p, seasonId);
  const left = stockLeft(p);
  const soldOut = left === 0;
  const price = fromPrice(p);
  return (
    <Link href={`${shopConfig(p.shop).base}/${p.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-3xl border border-line bg-surface">
        {p.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.images[0]} alt={p.name} loading="lazy" className={cn("h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]", soldOut && "opacity-60")} />
        ) : (
          <ProductPlaceholder shop={p.shop} />
        )}
        {/* Second photo fades in on hover, like turning the piece around */}
        {p.images[1] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.images[1]} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        )}
        {festive && !soldOut && <SeasonSparkle seasonId={seasonId} />}
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
          {p.tagline && <p className={p.shop === "lightlab" ? "ll-accent mt-1 line-clamp-2 text-xl" : "mt-1 line-clamp-2 text-sm text-muted"}>{p.tagline}</p>}
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

/** Until the owner adds photos: a lamp for LightLab, a little printed cube for the Coastline shop. */
export function ProductPlaceholder({ shop }: { shop: ShopId | string }) {
  if (shop !== "lightlab")
    return (
      <svg viewBox="0 0 100 100" className="h-full w-full text-accent-text" aria-hidden>
        <path d="M50 30l20 10v22l-20 10-20-10V40z" fill="currentColor" opacity="0.25" />
        <path d="M50 30l20 10-20 10-20-10z" fill="currentColor" opacity="0.5" />
      </svg>
    );
  return <LampPlaceholder />;
}

/** A simple pendant lamp, black and white. */
export function LampPlaceholder() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full text-fg" aria-hidden>
      <line x1="50" y1="0" x2="50" y2="34" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <path d="M32 52 Q50 26 68 52 Z" fill="currentColor" />
      <circle cx="50" cy="55" r="4" fill="var(--bg)" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
