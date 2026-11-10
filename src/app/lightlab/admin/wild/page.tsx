import { WildEditor } from "@/components/lightlab/admin/WildEditor";
import { db } from "@/lib/db";
import { allWildPhotos } from "@/lib/shop/wild.server";

export const metadata = { title: "In the wild" };
export const dynamic = "force-dynamic";

export default async function WildAdminPage() {
  const [photos, products] = await Promise.all([allWildPhotos(), db.shopProduct.findMany({ where: { shop: "lightlab", addon: false }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } })]);
  return <WildEditor initial={photos} products={products} />;
}
