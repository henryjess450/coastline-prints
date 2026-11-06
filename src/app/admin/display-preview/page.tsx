import { CustomerScreen } from "@/components/pos/CustomerScreen";
import { requireAdmin } from "@/lib/admin/auth";
import { loadDisplaySlides } from "@/lib/pos/slides.server";

export const metadata = { title: "Display preview", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The customer display between sales, full screen, as saved on Admin > Display. Quicker than the real one (3 s a slide); tap or press → to skip ahead. */
export default async function DisplayPreviewPage() {
  await requireAdmin("/admin/display-preview");
  return <CustomerScreen screen={{ stage: "idle", brand: "lightlab" }} slides={await loadDisplaySlides()} quick />;
}
