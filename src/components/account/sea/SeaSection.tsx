import { Reveal } from "@/components/home/Reveal";
import { cn } from "@/lib/cn";

/**
 * A section of the account page, sitting straight on the water: a small
 * label with a wave mark, a heading, and the content. No box around it.
 */
export function SeaSection({ id, label, title, intro, children, className }: { id: string; label: string; title: React.ReactNode; intro?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-24 py-12 sm:py-16", className)}>
      <Reveal>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent-text">
          <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden>
            <path d="M1 5 Q4.5 1 8 5 T15 5 T21 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {label}
        </p>
        <h2 id={`${id}-title`} className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h2>
        {intro && <p className="mt-3 max-w-2xl text-muted">{intro}</p>}
      </Reveal>
      <div className="mt-8">{children}</div>
    </section>
  );
}
