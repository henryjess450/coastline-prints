import { shopConfig } from "@config/shops";
import { getSeason } from "@/lib/season";
import { listProducts } from "@/lib/shop/products.server";
import { suggestFor, type ShopProductDto } from "@/lib/shop/types";
import { ProductCards } from "./ProductGrid";

/** "You might also like" under a product: hand-picked pairings, then this season, then the same category. */
export async function AlsoLike({ product }: { product: ShopProductDto }) {
  const shop = shopConfig(product.shop);
  const [all, season] = await Promise.all([listProducts({ shop: shop.id }), getSeason()]);
  const picks = suggestFor([product], all, season.id, 3);
  if (!picks.length) return null;
  const lightlab = shop.id === "lightlab";
  return (
    <section aria-labelledby="also-like" className="mt-24">
      <p className={lightlab ? "ll-accent text-3xl" : "text-xs font-semibold uppercase tracking-wider text-accent-text"}>{product.pairings.length ? "goes well with" : "keep looking"}</p>
      <h2 id="also-like" className="mb-8 mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
        You might also like
      </h2>
      <ProductCards products={picks} />
    </section>
  );
}
