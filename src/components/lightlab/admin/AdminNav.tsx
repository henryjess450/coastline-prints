"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

const links = [
  { href: "/lightlab/admin", label: "Products" },
  { href: "/lightlab/admin/products/new", label: "Add product" },
  { href: "/lightlab/admin/orders", label: "Orders" },
];

export function LightLabAdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="LightLab admin" className="-mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:w-fit sm:rounded-full sm:border sm:border-line sm:bg-surface sm:p-1">
      {links.map((l) => {
        const active = l.href === "/lightlab/admin" ? path === l.href || (path.startsWith("/lightlab/admin/products/") && !path.endsWith("/new")) : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={cn("relative shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors sm:py-1.5", active ? "text-accent-ink" : "text-muted hover:text-fg")}>
            {active && <motion.span layoutId="ll-admin-nav" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
