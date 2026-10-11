import Link from "next/link";
import { site } from "@config/site";
import { ButtonLink } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/Card";
import { guides, type Guide } from "@/lib/guides";
import { absolute, breadcrumbs, JsonLd } from "@/lib/seo";

const longDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

/**
 * The frame every guide shares: breadcrumb, title, the short answer up top,
 * the body, then a way to order and links to the other guides.
 */
export function GuidePage({ guide, answer, children }: { guide: Guide; answer: React.ReactNode; children: React.ReactNode }) {
  const path = `/guides/${guide.slug}`;
  return (
    <article className="mx-auto max-w-3xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: guide.title,
            description: guide.description,
            datePublished: guide.published,
            dateModified: guide.updated,
            url: absolute(path),
            mainEntityOfPage: absolute(path),
            image: absolute("/opengraph-image"),
            author: { "@type": "Organization", name: site.name, url: absolute() },
            publisher: { "@id": `${absolute()}/#business`, "@type": "LocalBusiness", name: site.name },
          },
          breadcrumbs([
            { name: "Home", path: "/" },
            { name: "Guides", path: "/guides" },
            { name: guide.title, path },
          ]),
        ]}
      />
      <nav aria-label="Breadcrumb" className="text-sm text-faint">
        <Link href="/guides" className="hover:text-fg hover:underline">
          Guides
        </Link>
      </nav>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight sm:text-5xl">{guide.title}</h1>
      <p className="mt-3 text-sm text-faint">Updated {longDate(guide.updated)}</p>
      <div className="mt-8 rounded-3xl border border-line bg-surface p-6 text-lg leading-relaxed sm:p-8">
        <SectionLabel>Short answer</SectionLabel>
        <div className="mt-2">{answer}</div>
      </div>
      <div className="guide-body mt-10 space-y-5 leading-relaxed text-muted [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-fg [&_a]:font-medium [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-2 [&_strong]:text-fg">
        {children}
      </div>
      <div className="mt-12 flex flex-wrap gap-4">
        <ButtonLink href="/order" size="lg">
          Get a price for your file
        </ButtonLink>
        <ButtonLink href="/faq" size="lg" variant="secondary">
          More questions
        </ButtonLink>
      </div>
      <section className="mt-16 border-t border-line pt-10">
        <h2 className="font-display text-xl font-bold">Other guides</h2>
        <ul className="mt-4 space-y-2">
          {guides
            .filter((g) => g.slug !== guide.slug)
            .map((g) => (
              <li key={g.slug}>
                <Link href={`/guides/${g.slug}`} className="font-medium text-accent-text underline underline-offset-4">
                  {g.title}
                </Link>
              </li>
            ))}
        </ul>
      </section>
    </article>
  );
}

/** A simple table that scrolls sideways on phones instead of squashing. */
export function GuideTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line text-fg">
            {head.map((h) => (
              <th key={h} scope="col" className="py-2 pr-4 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/60">
              {r.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className="py-2 pr-4 font-medium text-fg">
                    {c}
                  </th>
                ) : (
                  <td key={j} className="py-2 pr-4">
                    {c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
