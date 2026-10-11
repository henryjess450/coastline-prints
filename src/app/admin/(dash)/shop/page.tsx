import Link from "next/link";
import { ProductTable } from "@/components/lightlab/admin/ProductTable";
import { buttonClass } from "@/components/ui/Button";
import { requireAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { listProducts } from "@/lib/shop/products.server";

export const metadata = { title: "Shop" };

/** Coastline's ready-made products: things people can buy without a file. Same editor as LightLab. */
export default async function CoastlineShopAdmin() {
  await requireAdmin();
  const products = await listProducts({ all: true, shop: "coastline" });
  const sold = await db.orderItem.groupBy({ by: ["productId"], where: { productId: { in: products.map((p) => p.id) } }, _sum: { quantity: true, lineCents: true } });
  const stats = Object.fromEntries(sold.map((s) => [s.productId!, { units: s._sum.quantity ?? 0, cents: s._sum.lineCents ?? 0 }]));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Shop</h1>
          <p className="text-sm text-muted">
            Ready-made prints people can buy without a file, at{" "}
            <Link href="/shop" target="_blank" className="text-accent-text underline">
              /shop
            </Link>
            . Personalised products (like name keychains) ask the shopper for the text.
          </p>
        </div>
        {products.length > 0 && (
          <Link href="/admin/shop/products/new" className={buttonClass("primary", "md")}>
            Add a product
          </Link>
        )}
      </div>
      <ProductTable products={products} stats={stats} shop="coastline" />
    </div>
  );
}
