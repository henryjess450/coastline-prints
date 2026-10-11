import { ProductTable } from "@/components/lightlab/admin/ProductTable";
import { db } from "@/lib/db";
import { listProducts } from "@/lib/shop/products.server";

export const metadata = { title: "Products" };

export default async function LightLabProductsAdmin() {
  const products = await listProducts({ all: true });
  // Units sold per product (paid orders), for the list.
  const sold = await db.orderItem.groupBy({ by: ["productId"], where: { productId: { not: null } }, _sum: { quantity: true, lineCents: true } });
  const stats = Object.fromEntries(sold.map((s) => [s.productId!, { units: s._sum.quantity ?? 0, cents: s._sum.lineCents ?? 0 }]));
  return <ProductTable products={products} stats={stats} />;
}
