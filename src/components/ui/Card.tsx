import { cn } from "@/lib/cn";

export function Card({ className, highlight, ...rest }: React.HTMLAttributes<HTMLDivElement> & { highlight?: boolean }) {
  return <div className={cn("glass rounded-2xl", highlight && "card-accent", className)} {...rest} />;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">{children}</p>;
}
