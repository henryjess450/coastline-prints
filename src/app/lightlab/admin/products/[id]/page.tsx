import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/lightlab/admin/ProductEditor";
import { db } from "@/lib/db";
import { listProducts, toProductDto } from "@/lib/shop/products.server";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const row = await db.shopProduct.findUnique({ where: { id: (await params).id }, include: { files: { orderBy: { createdAt: "desc" } } } });
  if (!row) notFound();
  const all = await listProducts({ all: true });
  const categories = [...new Set(all.map((p) => p.category).filter(Boolean))];
  const others = all.map((p) => ({ id: p.id, name: p.name }));
  // Keyed so saving a new product (and landing here) starts a fresh editor.
  return <ProductEditor key={`${row.id}:${row.updatedAt.getTime()}`} product={toProductDto(row)} categories={categories} others={others} files={row.files.map((f) => ({ id: f.id, fileName: f.fileName, sizeBytes: f.sizeBytes, createdAt: f.createdAt.toISOString() }))} />;
}
