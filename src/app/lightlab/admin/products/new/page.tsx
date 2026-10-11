import { ProductEditor } from "@/components/lightlab/admin/ProductEditor";
import { listProducts } from "@/lib/shop/products.server";

export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  const categories = [...new Set((await listProducts({ all: true })).map((p) => p.category).filter(Boolean))];
  return <ProductEditor product={null} categories={categories} />;
}
