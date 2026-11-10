import { getCardFee } from "@/lib/pos/card-fee.server";
import { Register } from "@/components/pos/Register";
import { requireAdmin } from "@/lib/admin/auth";
import { getEffectiveConfig } from "@/lib/config/effective";
import { payLinksAvailable } from "@/lib/pos/paylink.server";
import { listProducts } from "@/lib/shop/products.server";
import { getPrintSettings } from "@/lib/receipt/settings";
import { db } from "@/lib/db";
import { shopToday } from "@/lib/shop/markets.server";
import { reviews, seo } from "@config/site";

export const metadata = { title: "Register" };

/** The in-person register for LightLab and Coastline Prints. The customer display lives at /pos. */
export default async function RegisterPage() {
  await requireAdmin();
  const [cfg, lightlab, coastline, printing, today] = await Promise.all([getEffectiveConfig(), listProducts({ shop: "lightlab" }), listProducts({ shop: "coastline" }), getPrintSettings(), db.market.findMany({ where: { date: shopToday() }, select: { name: true } })]);
  // Today's market days first, then the other receipt designs. Picked by name: the sale's source is the market's name, and receipts find their design by it.
  const names = [...new Set([...today.map((m) => m.name), ...printing.markets.map((m) => m.name)])];
  return (
    <Register
      products={{ lightlab, coastline }}
      markets={names.map((name) => ({ id: name, name: today.some((m) => m.name === name) ? `${name} (today)` : name }))}
      links={{ etransferEmail: process.env.ETRANSFER_EMAIL || null, instagram: seo.instagram, review: reviews.googleUrl || null, payLinks: payLinksAvailable(), cardFee: await getCardFee().then((f) => (f.on ? f : null)) }}
      printOptions={{
        materials: cfg.materials.map((m) => ({ id: m.id, name: m.name, colors: m.colors.filter((c) => c.available).map((c) => ({ id: c.id, name: c.name, hex: c.hex })) })),
        qualities: cfg.qualityPresets.map((q) => ({ id: q.id, name: q.name })),
        infills: cfg.infillPresets.map((i) => ({ id: i.id, name: i.name })),
      }}
    />
  );
}
