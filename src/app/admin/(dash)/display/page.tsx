import { DisplayEditor } from "@/components/admin/display/DisplayEditor";
import { requireAdmin } from "@/lib/admin/auth";
import { getDisplaySettings } from "@/lib/pos/slides.server";
import { listProducts } from "@/lib/shop/products.server";

export const metadata = { title: "Display" };

/** The customer display's slideshow between sales: which slides, in what order, which lamps, how fast. */
export default async function DisplayPage() {
  await requireAdmin();
  const [settings, products] = await Promise.all([getDisplaySettings(), listProducts({ shop: "lightlab" })]);
  return <DisplayEditor settings={settings} products={products.map((p) => ({ id: p.id, name: p.name, image: p.images[0] ?? null }))} />;
}
