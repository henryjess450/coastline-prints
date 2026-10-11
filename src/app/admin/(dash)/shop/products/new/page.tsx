import { ProductEditor } from "@/components/lightlab/admin/ProductEditor";
import { requireAdmin } from "@/lib/admin/auth";
import { listProducts } from "@/lib/shop/products.server";

export const metadata = { title: "Add product" };

export default async function NewShopProductPage() {
  await requireAdmin();
  const categories = [...new Set((await listProducts({ all: true, shop: "coastline" })).map((p) => p.category).filter(Boolean))];
  return <ProductEditor product={null} categories={categories} shop="coastline" />;
}
