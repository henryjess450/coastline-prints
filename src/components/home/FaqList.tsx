import Link from "next/link";
import type { Faq } from "@/lib/faq";

/** Questions that open in place. Used on the home page and /faq. */
export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="space-y-4">
      {faqs.map((f) => (
        <details key={f.q} className="group glass rounded-2xl px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
            {f.q}
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-line text-accent-text transition-transform duration-300 group-open:rotate-45" aria-hidden>
              +
            </span>
          </summary>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {f.a}{" "}
            {f.link && (
              <Link href={f.link.href} className="text-accent-text underline underline-offset-4">
                {f.link.label}
              </Link>
            )}
          </p>
        </details>
      ))}
    </div>
  );
}
