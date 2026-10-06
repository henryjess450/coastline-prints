"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useScroll, useTransform } from "framer-motion";
import { site } from "@config/site";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const nav = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/library", label: "Find a model" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#materials", label: "Materials" },
  { href: "/gift-cards", label: "Gift cards" },
  { href: "/status", label: "Order status" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const backdrop = useTransform(scrollY, [0, 60], [0, 1]);

  return (
    <header className="sticky top-0 z-40">
      <motion.div style={{ opacity: backdrop }} className="absolute inset-0 border-b border-line bg-bg/85 backdrop-blur-xl" aria-hidden />
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label={`${site.name} home`} className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-strong hover:text-fg">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {!pathname.startsWith("/order") && !pathname.startsWith("/admin") && (
            <ButtonLink href="/order" size="sm" className="hidden sm:inline-flex">
              Start an order
            </ButtonLink>
          )}
        </div>
      </div>
    </header>
  );
}
