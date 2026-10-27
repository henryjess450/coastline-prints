import { Register } from "@/components/pos/Register";
import { requireAdmin } from "@/lib/admin/auth";
import { getEffectiveConfig } from "@/lib/config/effective";
import { listProducts } from "@/lib/shop/products.server";

export const metadata = { title: "Register" };

/** The in-person register for LightLab and Coastline Prints. The customer display lives at /pos. */
export default async function RegisterPage() {
  await requireAdmin();
  const [cfg, lightlab, coastline] = await Promise.all([getEffectiveConfig(), listProducts({ shop: "lightlab" }), listProducts({ shop: "coastline" })]);
  return (
    <Register
      products={{ lightlab, coastline }}
      printOptions={{
        materials: cfg.materials.map((m) => ({ id: m.id, name: m.name, colors: m.colors.filter((c) => c.available).map((c) => ({ id: c.id, name: c.name, hex: c.hex })) })),
        qualities: cfg.qualityPresets.map((q) => ({ id: q.id, name: q.name })),
        infills: cfg.infillPresets.map((i) => ({ id: i.id, name: i.name })),
      }}
    />
  );
}
