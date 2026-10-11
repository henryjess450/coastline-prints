import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/lightlab/admin/ProductEditor";
import { requireAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { listProducts, toProductDto } from "@/lib/shop/products.server";

export const metadata = { title: "Edit product" };

export default async function EditShopProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const row = await db.shopProduct.findUnique({ where: { id: (await params).id } });
  if (!row) notFound();
  const categories = [...new Set((await listProducts({ all: true, shop: "coastline" })).map((p) => p.category).filter(Boolean))];
  // Keyed so saving a new product (and landing here) starts a fresh editor.
  return <ProductEditor key={`${row.id}:${row.updatedAt.getTime()}`} product={toProductDto(row)} categories={categories} />;
}
