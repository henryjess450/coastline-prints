import type { Metadata } from "next";
import { FaqList } from "@/components/home/FaqList";
import { ButtonLink } from "@/components/ui/Button";
import { getEffectiveConfig } from "@/lib/config/effective";
import { faqs } from "@/lib/faq";
import { breadcrumbs, faqPage, JsonLd, place } from "@/lib/seo";

export const metadata: Metadata = {
  title: "3D printing questions",
  description: `What 3D printing costs, which files and materials to use, how long it takes, and how pickup in ${place} and shipping across Canada work.`,
  alternates: { canonical: "/faq" },
};
export const dynamic = "force-dynamic"; // answers quote live rates

export default async function FaqPage() {
  const list = faqs(await getEffectiveConfig());
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
      <JsonLd data={[faqPage(list), breadcrumbs([{ name: "Home", path: "/" }, { name: "Questions", path: "/faq" }])]} />
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">3D printing questions</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">Prices, files, materials, pickup and shipping.</p>
      <div className="mt-12">
        <FaqList faqs={list} />
      </div>
      <div className="mt-12 flex flex-wrap gap-4">
        <ButtonLink href="/order" size="lg">
          Start an order
        </ButtonLink>
        <ButtonLink href="/3d-printing" size="lg" variant="secondary">
          What people print
        </ButtonLink>
      </div>
    </div>
  );
}
