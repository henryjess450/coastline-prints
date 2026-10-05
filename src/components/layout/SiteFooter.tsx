import Link from "next/link";
import { legal, site } from "@config/site";
import { CircleMark } from "./CircleMark";
import { Logo } from "./Logo";
import { ProudlyCanadian } from "./ProudlyCanadian";

const links = [
  { href: "/order", label: "Start an order" },
  { href: "/library", label: "Find a model" },
  { href: "/status", label: "Order status" },
  { href: "/#faq", label: "FAQ" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy", label: "Privacy Policy" },
];

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-line">
      <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <div className="flex flex-col gap-6 rounded-3xl border border-line bg-surface p-8 sm:flex-row sm:items-center sm:gap-8 sm:p-12">
          <CircleMark size={64} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/lettering/questions.png" alt="Questions or concerns?" className="h-7 w-auto max-w-full invert light:invert-0 sm:h-9" />
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Email{" "}
              <a href={`mailto:${legal.contactEmail}`} className="font-medium text-accent-text underline underline-offset-4">
                {legal.contactEmail}
              </a>{" "}
              or{" "}
              <Link href="/status" className="font-medium text-accent-text underline underline-offset-4">
                check your order status
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-4 pt-14 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Logo />
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-muted sm:flex sm:flex-wrap sm:gap-x-6">
          {links.map((l) => (
            <Link key={l.href} className="hover:text-fg hover:underline" href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-faint">
          © {new Date().getFullYear()} {site.name}. Prices in CAD.
        </p>
      </div>
      {/* Flagpole sits flush with the very bottom of the page */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <ProudlyCanadian />
      </div>
    </footer>
  );
}
