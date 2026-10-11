import type { Metadata } from "next";
import Link from "next/link";
import { seo } from "@config/site";
import { ButtonLink } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/Card";
import { breadcrumbs, JsonLd, place } from "@/lib/seo";
import { uses } from "@/lib/uses";

export const metadata: Metadata = {
  title: `3D printing services in ${place}`,
  description: `Replacement parts, cosplay, tabletop terrain, gifts and prototypes, 3D printed in ${seo.city}. Upload a file, see the price, pick up or ship across Canada.`,
  alternates: { canonical: "/3d-printing" },
};

export default function UsesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "3D printing", path: "/3d-printing" }])} />
      <SectionLabel>3D printing in {place}</SectionLabel>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">What people get printed</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">If you have a file, upload it and see the price. If you don&apos;t, these are good places to start.</p>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2">
        {uses.map((u) => (
          <li key={u.slug}>
            <Link
              href={`/3d-printing/${u.slug}`}
              className="block h-full rounded-3xl border border-line bg-surface p-6 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow)] sm:p-8"
            >
              <h2 className="font-display text-2xl font-bold">{u.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{u.examples.slice(0, 3).join(", ")} and more.</p>
              <p className="mt-4 text-sm font-medium text-accent-text">{u.material ? `Usually ${u.material.id}` : "See how it works"} →</p>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-12 flex flex-wrap gap-4">
        <ButtonLink href="/order" size="lg">
          Start an order
        </ButtonLink>
        <ButtonLink href="/faq" size="lg" variant="secondary">
          Questions
        </ButtonLink>
      </div>
    </div>
  );
}
