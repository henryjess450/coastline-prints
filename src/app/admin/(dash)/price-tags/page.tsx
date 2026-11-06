import { PriceTags } from "@/components/admin/price-tags/PriceTags";
import { requireAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { getTagSize } from "@/lib/receipt/price-tag";
import { cleanColors } from "@/lib/receipt/price-tag";

export const metadata = { title: "Price tags" };

/** Price tags for the market stand: a drawing and colours per product, previewed here, printed from a PDF at real size. */
export default async function PriceTagsPage({ searchParams }: { searchParams: Promise<{ shop?: string }> }) {
  await requireAdmin();
  const shop = (await searchParams).shop === "coastline" ? "coastline" : "lightlab";
  const [rows, size] = await Promise.all([db.shopProduct.findMany({ where: { active: true }, orderBy: [{ shop: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }), getTagSize()]);
  return (
    <PriceTags
      shop={shop}
      size={size}
      products={rows.map((p) => ({ id: p.id, shop: p.shop === "coastline" ? "coastline" : "lightlab", name: p.name, image: p.tagImage, colors: cleanColors(JSON.parse(p.tagColors)), priceColor: p.tagPriceColor }))}
    />
  );
}
