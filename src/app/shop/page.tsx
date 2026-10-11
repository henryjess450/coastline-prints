import type { Metadata } from "next";
import { seo } from "@config/site";
import { ProductGrid } from "@/components/lightlab/ProductGrid";
import { ButtonLink } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/Card";
import { listProducts } from "@/lib/shop/products.server";
import { breadcrumbs, JsonLd, place } from "@/lib/seo";

export const dynamic = "force-dynamic"; // stock and prices change in admin

export async function generateMetadata(): Promise<Metadata> {
  const any = (await listProducts({ shop: "coastline" })).length > 0;
  return {
    title: `Ready-made 3D prints in ${place}`,
    description: `Name keychains, planters, cable clips and more, 3D printed in downtown ${seo.city}. No file needed: pick it, personalise it, pick it up or have it shipped.`,
    alternates: { canonical: "/shop" },
    // An empty shop isn't worth a search result yet.
    ...(any ? {} : { robots: { index: false } }),
  };
}

/** Coastline's ready-made products, for people who don't have a file. */
export default async function ShopPage() {
  const products = await listProducts({ shop: "coastline" });
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Shop", path: "/shop" }])} />
      <div className="mb-12 max-w-2xl">
        <SectionLabel>No file needed</SectionLabel>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Ready-made prints</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">Pick a design, add a name if it asks for one, and we print it. Pickup in downtown {seo.city} or shipping anywhere in Canada.</p>
      </div>
      {products.length ? (
        <ProductGrid products={products} />
      ) : (
        <div className="rounded-3xl border border-line bg-surface px-6 py-16 text-center">
          <p className="font-display text-xl font-semibold">The shop opens soon.</p>
          <p className="mx-auto mt-2 max-w-md text-muted">In the meantime, upload any model and see the price, or find one to print.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/order">Start an order</ButtonLink>
            <ButtonLink href="/library" variant="secondary">
              Find a model
            </ButtonLink>
          </div>
        </div>
      )}
      {products.length > 0 && (
        <p className="mt-16 text-center text-muted">
          Want something that isn&apos;t here?{" "}
          <a href="/order" className="font-medium text-accent-text underline underline-offset-4">
            Upload your own file
          </a>{" "}
          and see the price right away.
        </p>
      )}
    </div>
  );
}
