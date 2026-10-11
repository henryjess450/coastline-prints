import type { Metadata } from "next";
import Link from "next/link";
import { lightlab } from "@config/lightlab";
import { CircleMark } from "@/components/layout/CircleMark";
import { LightLabHeroText } from "@/components/lightlab/HeroText";
import { OneLineLamps } from "@/components/lightlab/hero/OneLineLamps";
import { LightLabLogo } from "@/components/lightlab/LightLabLogo";
import { ProductGrid } from "@/components/lightlab/ProductGrid";
import { ButtonLink } from "@/components/ui/Button";
import { listProducts } from "@/lib/shop/products.server";

export const metadata: Metadata = { title: { absolute: `${lightlab.name} · Novelty lamps` } };
export const dynamic = "force-dynamic"; // prices and stock change in /lightlab/admin

export default async function LightLabShop() {
  const products = await listProducts();
  const featured = [...products].sort((a, b) => Number(b.featured) - Number(a.featured));

  return (
    <div className="overflow-x-clip">
      <section className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 pb-16 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_400px] lg:pb-24">
        <LightLabHeroText />
        {/* Fun-gi, Banana After Dark and Cloudy, drawn in line one after another */}
        <div className="mx-auto aspect-[4/5] w-full max-w-[300px] lg:max-w-[400px]">
          <OneLineLamps />
        </div>
      </section>

      <section id="shop" className="mx-auto max-w-7xl scroll-mt-24 px-4 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="ll-accent text-3xl">the collection</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Shop LightLab</h2>
          </div>
          {products.length > 0 && <p className="text-sm text-muted">{products.length} {products.length === 1 ? "piece" : "pieces"}</p>}
        </div>
        {products.length ? (
          <ProductGrid products={featured} />
        ) : (
          <div className="rounded-3xl border border-line bg-surface px-6 py-16 text-center">
            <p className="font-display text-xl font-semibold">New pieces are on the way.</p>
            <p className="mt-2 text-muted">Check back soon.</p>
          </div>
        )}
      </section>

      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 rounded-3xl border border-line bg-surface p-8 sm:p-12 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
          <div className="flex items-center gap-4 sm:gap-6">
            <CircleMark size={72} className="shrink-0" />
            <span aria-hidden className="text-3xl font-light text-faint">
              ×
            </span>
            <LightLabLogo className="h-16 sm:h-20" />
          </div>
          <div>
            <p className="ll-accent text-3xl">preferred partner</p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">{lightlab.partnerLine}</h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-muted">
              LightLab orders go through Coastline Prints: the same checkout, the same pickup times and Canada Post shipping, and Coastline gift cards work here too. Got a design of your own? Coastline Prints will print it from your STL or 3MF file.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/order" variant="secondary">
                Print your own file
              </ButtonLink>
              <Link href="/" className="inline-flex items-center px-2 text-sm text-accent-text underline underline-offset-4">
                About Coastline Prints
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
