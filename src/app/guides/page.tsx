import type { Metadata } from "next";
import Link from "next/link";
import { guides } from "@/lib/guides";
import { breadcrumbs, JsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "3D printing guides",
  description: "Plain answers about 3D printing: what it costs in Victoria, which filament to pick, and how to get a file to print.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }])} />
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Guides</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">Plain answers to the questions people ask before their first print.</p>
      <ul className="mt-12 space-y-4">
        {guides.map((g) => (
          <li key={g.slug}>
            <Link href={`/guides/${g.slug}`} className="block rounded-3xl border border-line bg-surface p-6 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow)] sm:p-8">
              <h2 className="font-display text-xl font-bold sm:text-2xl">{g.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{g.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
