"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useScroll, useTransform } from "framer-motion";
import { site } from "@config/site";
import { buttonClass, ButtonLink } from "@/components/ui/Button";
import { Topper, Trim } from "@/components/season/HeaderDecor";
import { useSeason } from "@/components/season/SeasonContext";
import { Logo } from "./Logo";
import { CoBrand } from "@/components/lightlab/CoBrand";
import { CartButton } from "@/components/lightlab/CartButton";
import { LightLabLogo } from "@/components/lightlab/LightLabLogo";

const nav = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/library", label: "Find a model" },
  { href: "/gift-cards", label: "Gift cards" },
  { href: "/rewards", label: "Rewards" },
];

export function SiteHeader({ shopOpen = false }: { shopOpen?: boolean }) {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const backdrop = useTransform(scrollY, [0, 60], [0, 1]);
  const season = useSeason();
  // The LightLab shop (not its admin) gets both logos and a cart.
  const lightlab = pathname.startsWith("/lightlab") && !pathname.startsWith("/lightlab/admin");
  // The Coastline shop gets its own cart.
  const shop = pathname === "/shop" || pathname.startsWith("/shop/");

  return (
    <header className="sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
      <motion.div style={{ opacity: backdrop }} className="absolute inset-0 border-b border-line bg-bg/85 backdrop-blur-xl" aria-hidden />
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {lightlab ? (
          <div className="relative min-w-0">
            <CoBrand />
          </div>
        ) : (
          <Link href="/" aria-label={`${site.name} home`} className="relative shrink-0">
            {season.topper && <Topper kind={season.topper} />}
            <Logo />
          </Link>
        )}
        <nav aria-label="Main" className={lightlab ? "hidden" : "hidden items-center gap-1 lg:flex"}>
          {(shopOpen ? [...nav.slice(0, 2), { href: "/shop", label: "Shop" }, ...nav.slice(2)] : nav).map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-strong hover:text-fg">
              {n.label}
            </Link>
          ))}
          <LightLabLink />
        </nav>
        <div className="flex items-center gap-3">
          {/* Phones have no nav row, so the LightLab logo sits with the buttons. */}
          {!lightlab && !pathname.startsWith("/admin") && <LightLabLink className="lg:hidden" />}
          {!pathname.startsWith("/admin") && (
            <Link href="/account" aria-label="Your account" title="Your account" className={buttonClass("secondary", "sm", "w-10 px-0")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
              </svg>
            </Link>
          )}
          {lightlab && <CartButton />}
          {shop && <CartButton shop="coastline" />}
          {!lightlab && !shop && !pathname.startsWith("/order") && !pathname.startsWith("/admin") && (
            <ButtonLink href="/order" size="sm" className="hidden sm:inline-flex">
              Start an order
            </ButtonLink>
          )}
        </div>
      </div>
      {season.trim && <Trim kind={season.trim} />}
    </header>
  );
}


/** The partner shop's logo as a menu item. */
function LightLabLink({ className }: { className?: string }) {
  return (
    <Link href="/lightlab" aria-label="LightLab lamp shop" title="LightLab lamp shop" className={`flex h-9 items-center rounded-md px-2.5 transition-[background-color,opacity] hover:bg-surface-strong ${className ?? ""}`}>
      <LightLabLogo className="h-5" />
    </Link>
  );
}
