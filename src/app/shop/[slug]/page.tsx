import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { site } from "@config/site";
import { ProductBuy } from "@/components/lightlab/ProductBuy";
import { money } from "@/lib/format";
import { productBySlug } from "@/lib/shop/products.server";
import { absolute, breadcrumbs, JsonLd } from "@/lib/seo";
import { inStock } from "@/lib/shop/types";

export const dynamic = "force-dynamic";

const fromPrice = (p: { priceCents: number; variants: { priceCents: number | null }[] }) => Math.min(p.priceCents, ...p.variants.map((v) => v.priceCents ?? p.priceCents));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await productBySlug((await params).slug, "coastline");
  if (!p) return {};
  const description = [money(fromPrice(p)), p.tagline || p.description.slice(0, 140)].filter(Boolean).join(" · ");
  return { title: p.name, description, alternates: { canonical: `/shop/${p.slug}` }, openGraph: { title: `${p.name} · ${site.name}`, description, images: p.images[0] ? [p.images[0]] : undefined } };
}

export default async function ShopProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await productBySlug((await params).slug, "coastline");
  if (!p) notFound();
  const left = p.variants.length ? null : inStock(p, null);
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name: p.name,
            description: p.description || p.tagline,
            image: p.images.map((i) => absolute(i)),
            url: absolute(`/shop/${p.slug}`),
            brand: { "@type": "Brand", name: site.name },
            offers: {
              "@type": "Offer",
              price: (fromPrice(p) / 100).toFixed(2),
              priceCurrency: "CAD",
              availability: left === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
              url: absolute(`/shop/${p.slug}`),
            },
          },
          breadcrumbs([
            { name: "Home", path: "/" },
            { name: "Shop", path: "/shop" },
            { name: p.name, path: `/shop/${p.slug}` },
          ]),
        ]}
      />
      <Link href="/shop" className="text-sm text-muted hover:text-fg">
        ← All ready-made prints
      </Link>
      <div className="mt-6">
        <ProductBuy product={p} />
      </div>
    </div>
  );
}
