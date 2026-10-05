import { legal } from "@config/site";

/** Shared layout for the legal pages: readable column, numbered sections. */
export function LegalPage({ title, intro, children }: { title: string; intro: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-8 pt-12 sm:px-6">
      <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-faint">Last updated {legal.lastUpdated}</p>
      <div className="mt-6 text-muted">{intro}</div>
      <div className="mt-10 space-y-10 [counter-reset:section]">{children}</div>
    </article>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="[counter-increment:section]">
      <h2 className="flex items-baseline gap-3 font-display text-xl font-bold text-fg before:grid before:h-8 before:w-8 before:shrink-0 before:place-items-center before:rounded-full before:bg-accent before:text-sm before:text-accent-ink before:content-[counter(section)]">
        {title}
      </h2>
      <div className="mt-3 space-y-3 leading-relaxed text-muted [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_strong]:text-fg">{children}</div>
    </section>
  );
}
