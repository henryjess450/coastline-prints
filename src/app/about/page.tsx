import type { Metadata } from "next";
import Link from "next/link";
import { legal, seo, site } from "@config/site";
import { ButtonLink } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/Card";
import { getEffectiveConfig } from "@/lib/config/effective";
import { money } from "@/lib/format";
import { absolute, breadcrumbs, JsonLd, localBusiness } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About",
  description: `${site.name} is a 3D printing shop in ${seo.neighbourhood}, BC. Instant online prices, prints in 2 to 5 days, pickup downtown or shipping across Canada.`,
  alternates: { canonical: "/about" },
};
export const dynamic = "force-dynamic"; // quotes live rates

export default async function AboutPage() {
  const cfg = await getEffectiveConfig();
  const p = cfg.pricing;
  const largest = Math.max(...cfg.printers.map((pr) => Math.min(pr.buildVolume.x, pr.buildVolume.y, pr.buildVolume.z))) - cfg.safetyMarginMm;

  const facts: [string, React.ReactNode][] = [
    ["Where", `${seo.neighbourhood}, ${seo.regionName}. Pickup downtown, shipping anywhere in Canada with Canada Post.`],
    ["What", "Custom FDM 3D printing from your STL or 3MF file, one part or up to 50 copies."],
    ["Materials", `${cfg.materials.map((m) => m.name).join(", ")}, in ${cfg.materials.reduce((n, m) => n + m.colors.filter((c) => c.available).length, 0)} colours. Up to 4 colours in one part.`],
    ["Printers", `${cfg.printers.map((pr) => pr.name).join(" and ")}. Parts up to ${largest} mm on each side.`],
    ["Turnaround", "Usually 2 to 5 days."],
    ["Pricing", `${money(p.baseFeeCents)} per order, plus ${p.pricePerGramCents}¢ per gram and ${money(p.pricePerHourCents)} per printer hour. Minimum order ${money(p.minimumOrderCents)}. Prices in CAD, shown before you pay.`],
    ["Payment", "Card, Apple Pay, Google Pay or Interac e-Transfer."],
    ["Opened", seo.founded],
    [
      "Contact",
      <>
        <a href={`mailto:${legal.contactEmail}`}>{legal.contactEmail}</a> or <a href={seo.instagram}>@coastline.printz</a> on Instagram
      </>,
    ],
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
      <JsonLd
        data={[
          { "@context": "https://schema.org", "@type": "AboutPage", url: absolute("/about"), about: { "@id": `${absolute()}/#business` } },
          localBusiness(),
          breadcrumbs([{ name: "Home", path: "/" }, { name: "About", path: "/about" }]),
        ]}
      />
      <SectionLabel>About</SectionLabel>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">A 3D print shop in downtown Victoria</h1>
      <p className="mt-5 text-lg leading-relaxed text-muted">
        {site.name} prints parts from your own files. You upload a model, see the price straight away, and pay only for what you see. No emailing back and forth for a quote. Prints are made here in Victoria and are ready for pickup
        downtown, or shipped anywhere in Canada.
      </p>
      <dl className="mt-12 divide-y divide-line border-y border-line">
        {facts.map(([k, v]) => (
          <div key={k} className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr] sm:gap-6">
            <dt className="font-medium">{k}</dt>
            <dd className="text-muted [&_a]:font-medium [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-4">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-8 text-muted">
        New to 3D printing? Start with <Link href="/guides/3d-printing-cost" className="font-medium text-accent-text underline underline-offset-4">what it costs</Link> or{" "}
        <Link href="/3d-printing" className="font-medium text-accent-text underline underline-offset-4">what people print</Link>.
      </p>
      <div className="mt-10">
        <ButtonLink href="/order" size="lg">
          Start an order
        </ButtonLink>
      </div>
    </div>
  );
}
