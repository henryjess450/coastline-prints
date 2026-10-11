import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { seo, site } from "@config/site";
import { ButtonLink } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/Card";
import { absolute, breadcrumbs, JsonLd, place } from "@/lib/seo";
import { findUse, uses } from "@/lib/uses";

export const dynamicParams = false;
export const generateStaticParams = () => uses.map((u) => ({ slug: u.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const u = findUse((await params).slug);
  if (!u) return {};
  return { title: u.absoluteTitle ? { absolute: u.absoluteTitle } : `${u.title} in ${place}`, description: u.description, alternates: { canonical: `/3d-printing/${u.slug}` } };
}

export default async function UsePage({ params }: { params: Promise<{ slug: string }> }) {
  const u = findUse((await params).slug);
  if (!u) notFound();
  const others = uses.filter((o) => o.slug !== u.slug);
  const path = `/3d-printing/${u.slug}`;

  return (
    <article className="mx-auto max-w-3xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: u.absoluteTitle ? u.title : `${u.title} in ${place}`,
            serviceType: "3D printing",
            description: u.description,
            url: absolute(path),
            provider: { "@id": `${absolute()}/#business`, "@type": "LocalBusiness", name: site.name },
            areaServed: seo.areaServed.map((name) => ({ "@type": "Place", name })),
          },
          breadcrumbs([
            { name: "Home", path: "/" },
            { name: "3D printing", path: "/3d-printing" },
            { name: u.name, path },
          ]),
        ]}
      />
      <nav aria-label="Breadcrumb" className="text-sm text-faint">
        <Link href="/3d-printing" className="hover:text-fg hover:underline">
          3D printing
        </Link>{" "}
        / {u.name}
      </nav>
      <div className="mt-8">
        <SectionLabel>3D printing in {place}</SectionLabel>
      </div>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">{u.h1}</h1>
      {u.intro.map((p) => (
        <p key={p} className="mt-5 text-lg leading-relaxed text-muted">
          {p}
        </p>
      ))}
      <div className="mt-10 flex flex-wrap gap-4">
        <ButtonLink href="/order" size="lg">
          Upload a file
        </ButtonLink>
        <ButtonLink href={u.search ? `/library?q=${encodeURIComponent(u.search)}` : "/library"} size="lg" variant="secondary">
          Find a model
        </ButtonLink>
      </div>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-bold">{u.examplesHeading ?? "What people print"}</h2>
        <ul className="mt-5 grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {u.examples.map((e) => (
            <li key={e} className="flex gap-3 leading-relaxed">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              {e}
            </li>
          ))}
        </ul>
      </section>

      {u.ideas && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">{u.ideas.heading}</h2>
          <ul className="mt-5 space-y-2">
            {u.ideas.items.map((e) => (
              <li key={e} className="flex gap-3 leading-relaxed">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {e}
              </li>
            ))}
          </ul>
        </section>
      )}

      {u.material && (
        <section className="mt-12 rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <SectionLabel>Best material</SectionLabel>
          <h2 className="mt-2 font-display text-2xl font-bold">{u.material.id}</h2>
          <p className="mt-3 leading-relaxed text-muted">
            {u.material.why}{" "}
            <Link href="/guides/pla-vs-petg-vs-pla-cf" className="text-accent-text underline underline-offset-4">
              PLA vs PETG vs PLA-CF
            </Link>
          </p>
          <Link href="/#materials" className="mt-4 inline-block text-sm font-medium text-accent-text underline underline-offset-4">
            See the colours in stock
          </Link>
        </section>
      )}

      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold">Before you order</h2>
        <ul className="mt-5 space-y-3">
          {u.tips.map((t) => (
            <li key={t} className="flex gap-3 leading-relaxed text-muted">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted">
          Ready in 2 to 5 days for pickup in {seo.city}, or shipped anywhere in Canada.{" "}
          <Link href="/faq" className="font-medium text-accent-text underline underline-offset-4">
            More questions
          </Link>
        </p>
      </section>

      <section className="mt-16 border-t border-line pt-10">
        <h2 className="font-display text-xl font-bold">Other things we print</h2>
        <ul className="mt-4 flex flex-wrap gap-3">
          {others.map((o) => (
            <li key={o.slug}>
              <Link href={`/3d-printing/${o.slug}`} className="inline-block rounded-full border border-line px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent-text">
                {o.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
