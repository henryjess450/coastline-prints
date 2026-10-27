import Link from "next/link";
import { NewOrderForm } from "@/components/admin/NewOrderForm";
import { requireAdmin } from "@/lib/admin/auth";
import { getEffectiveConfig } from "@/lib/config/effective";
import { db } from "@/lib/db";
import { SOURCE_SUGGESTIONS } from "@/lib/orders/manual";
import { listProducts } from "@/lib/shop/products.server";

export const metadata = { title: "New order" };

/** Type in an order from somewhere else: Facebook Marketplace, a market stall, a DM... */
export default async function NewOrderPage() {
  await requireAdmin();
  const [cfg, lightlab, coastline, used] = await Promise.all([
    getEffectiveConfig(),
    listProducts({ shop: "lightlab" }),
    listProducts({ shop: "coastline" }),
    // Sources typed in before come up first next time.
    db.order.findMany({ where: { sourceDetail: { contains: '"manual":true' }, source: { not: null } }, select: { source: true }, distinct: ["source"], orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const sources = [...new Set([...used.map((o) => o.source!), ...SOURCE_SUGGESTIONS])];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/orders" className="text-sm text-muted hover:text-fg">
          ← Orders
        </Link>
        <h1 className="mt-1 font-display text-3xl font-bold">New order</h1>
        <p className="text-sm text-muted">For orders that came in somewhere else. Priced like the site; nothing is charged here.</p>
      </div>
      <NewOrderForm
        materials={cfg.materials.map((m) => ({ id: m.id, name: m.name, colors: m.colors.filter((c) => c.available).map((c) => ({ id: c.id, name: c.name, hex: c.hex })) }))}
        qualities={cfg.qualityPresets.map((q) => ({ id: q.id, name: q.name }))}
        infills={cfg.infillPresets.map((i) => ({ id: i.id, name: i.name }))}
        shops={[
          { id: "coastline", name: "Coastline shop", products: coastline },
          { id: "lightlab", name: "LightLab", products: lightlab },
        ]}
        sources={sources}
      />
    </div>
  );
}
