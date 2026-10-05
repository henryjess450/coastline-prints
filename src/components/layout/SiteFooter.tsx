import Link from "next/link";
import { site } from "@config/site";
import { Logo } from "./Logo";

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
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Logo />
          <p className="max-w-xs text-sm text-muted">Custom 3D printing in PLA, PETG and PLA-CF. {site.fulfillmentLabel} only, no shipping.</p>
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
    </footer>
  );
}
