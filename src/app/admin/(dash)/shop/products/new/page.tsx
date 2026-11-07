import { ProductEditor } from "@/components/lightlab/admin/ProductEditor";
import { requireAdmin } from "@/lib/admin/auth";
import { listProducts } from "@/lib/shop/products.server";

export const metadata = { title: "Add product" };

export default async function NewShopProductPage() {
  await requireAdmin();
  const all = await listProducts({ all: true, shop: "coastline" });
  const categories = [...new Set(all.map((p) => p.category).filter(Boolean))];
  const others = all.map((p) => ({ id: p.id, name: p.name }));
  return <ProductEditor product={null} categories={categories} others={others} shop="coastline" />;
}
