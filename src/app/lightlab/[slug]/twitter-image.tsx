import { lightlab } from "@config/lightlab";
import { money } from "@/lib/format";
import { SHARE_SIZE } from "@/lib/og/share-card";
import { productBySlug } from "@/lib/shop/products.server";
import { lightlabShareCard } from "@/lib/shop/share-card";

export const runtime = "nodejs";
export const alt = `A lamp from ${lightlab.name}`;
export const size = SHARE_SIZE;
export const contentType = "image/png";

/** The link preview for a product: its photo, name, line and price. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const p = await productBySlug((await params).slug);
  if (!p) return lightlabShareCard({ title: "Novelty lamps", line: "made in Victoria, BC" });
  const from = Math.min(p.priceCents, ...p.variants.map((v) => v.priceCents ?? p.priceCents));
  const varies = p.variants.some((v) => v.priceCents != null && v.priceCents !== p.priceCents);
  return lightlabShareCard({ title: p.name, line: p.tagline || undefined, price: `${varies ? "from " : ""}${money(from)}`, imageKey: p.imageKeys[0] });
}
