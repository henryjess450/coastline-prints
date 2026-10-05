import { cn } from "@/lib/cn";

/**
 * `flat` is the home page look: a quiet bordered panel with generous rounding
 * and no glass blur or shadow. The order flow uses it.
 */
export function Card({ className, highlight, flat, ...rest }: React.HTMLAttributes<HTMLDivElement> & { highlight?: boolean; flat?: boolean }) {
  return <div className={cn(flat ? "rounded-3xl border border-line bg-surface" : "glass rounded-2xl", highlight && "card-accent", className)} {...rest} />;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">{children}</p>;
}
