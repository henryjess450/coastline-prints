import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PartnerBadge } from "@/components/lightlab/PartnerBadge";
import { AlsoLike } from "@/components/lightlab/AlsoLike";
import { WildWall } from "@/components/lightlab/WildWall";
import { wildPhotos } from "@/lib/shop/wild.server";
import { currentStand } from "@/lib/shop/stand.server";
import { ProductBuy } from "@/components/lightlab/ProductBuy";
import { productBySlug } from "@/lib/shop/products.server";
import { variantFromParam } from "@/lib/shop/types";
import { shopShips } from "@/lib/shop/shipping-switch.server";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await productBySlug((await params).slug);
  if (!p) return {};
  // The share picture comes from opengraph-image.tsx; the text says what it is and what it costs.
  const from = Math.min(p.priceCents, ...p.variants.map((v) => v.priceCents ?? p.priceCents));
  const description = [money(from), p.tagline].filter(Boolean).join(" · ");
  return { title: p.name, description, openGraph: { title: `${p.name} · LightLab | Victoria`, description }, twitter: { card: "summary_large_image", title: p.name, description } };
}

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ colour?: string | string[] }> }) {
  const product = await productBySlug((await params).slug);
  if (!product) notFound();
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
      <Link href="/lightlab#shop" className="ll-link text-sm text-muted hover:text-fg">
        ← All LightLab pieces
      </Link>
      <div className="mt-6">
        <ProductBuy product={product} ships={await shopShips("lightlab")} stand={await currentStand()} initialVariant={variantFromParam(product, (await searchParams).colour)?.id ?? null} />
      </div>
      {/* Customers' photos of this lamp at home. */}
      <div className="-mx-4 sm:-mx-6">
        <WildWall photos={await wildPhotos({ productId: product.id, limit: 8 })} products={new Map()} title={`${product.name}, in the wild`} kicker="at home" />
      </div>
      <AlsoLike product={product} />
      <div className="mt-20 flex justify-center">
        <PartnerBadge />
      </div>
    </div>
  );
}
