"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { shopConfig, type ShopId } from "@config/shops";
import { useSeason } from "@/components/season/SeasonContext";
import { money } from "@/lib/format";
import { cartFor } from "@/lib/shop/cart";
import { inSeason, inStock, suggestFor, type ShopProductDto } from "@/lib/shop/types";

/**
 * "Add a little extra" at checkout: pieces that go with what's in the cart
 * (hand-picked pairings first, then this holiday's, then the same category).
 * Simple pieces add in one tap; ones with options or a name open their page.
 */
export function CartSuggestions({ products, shop }: { products: ShopProductDto[]; shop: ShopId }) {
  const useCart = cartFor(shop);
  const lines = useCart((s) => s.lines);
  const add = useCart((s) => s.add);
  const setOpen = useCart((s) => s.setOpen);
  const season = useSeason();
  const inCart = products.filter((p) => lines.some((l) => l.productId === p.id));
  const picks = suggestFor(inCart, products, season.id, 3);
  const { base } = shopConfig(shop);
  if (!picks.length) return null;

  return (
    <section aria-labelledby="cart-extras" className="mb-10 rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <h2 id="cart-extras" className="font-display text-lg font-semibold">
        {picks.some((p) => inSeason(p, season.id)) ? `Add a little ${season.id === "coastline" ? "extra" : season.name} to it` : "Add a little extra"}
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        <AnimatePresence initial={false}>
          {picks.map((p) => {
            const simple = !p.variants.length && !p.personalize;
            const left = inStock(p, null);
            return (
              <motion.li key={p.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="flex items-center gap-3 rounded-2xl border border-line bg-bg p-2.5">
                <Link href={`${base}/${p.slug}`} className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.images[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" />}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`${base}/${p.slug}`} className="block truncate text-sm font-medium hover:underline">
                    {p.name}
                  </Link>
                  <p className="font-mono text-xs text-muted">{money(p.priceCents)}</p>
                </div>
                {simple ? (
                  <button
                    type="button"
                    onClick={() => {
                      add({ productId: p.id, variantId: null, quantity: 1, customText: null, slug: p.slug, name: p.name, variantName: null, swatch: null, image: p.images[0] ?? null, unitCents: p.priceCents, max: left });
                      // Adding opens the cart drawer; at checkout the order summary already shows it.
                      setOpen(false);
                    }}
                    className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink transition-transform active:scale-95"
                  >
                    Add
                  </button>
                ) : (
                  <Link href={`${base}/${p.slug}`} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:text-fg">
                    Choose
                  </Link>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </section>
  );
}
