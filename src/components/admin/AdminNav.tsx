"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { logoutAction } from "@/app/admin/actions";
import { cn } from "@/lib/cn";

const links = [
  { href: "/admin", label: "Orders" },
  { href: "/admin/queues", label: "Printer queues" },
  { href: "/admin/codes", label: "Codes" },
  { href: "/admin/etransfers", label: "e-Transfers" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav({ failedEmails, etransferReview = 0 }: { failedEmails: number; etransferReview?: number }) {
  const path = usePathname();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Admin" className="flex gap-1 rounded-full border border-line bg-surface p-1">
        {links.map((l) => {
          const active = l.href === "/admin" ? path === "/admin" || path.startsWith("/admin/orders") : path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={cn("relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors", active ? "text-accent-ink" : "text-muted hover:text-fg")}>
              {active && <motion.span layoutId="admin-nav" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <span className="relative">{l.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-3 text-sm">
        {etransferReview > 0 && (
          <Link href="/admin/etransfers" className="rounded-full bg-warning/15 px-3 py-1 font-medium text-warning">
            {etransferReview} e-Transfer{etransferReview === 1 ? "" : "s"} to check
          </Link>
        )}
        {failedEmails > 0 && (
          <Link href="/admin?status=EMAIL_FAILED" className="rounded-full bg-danger/15 px-3 py-1 font-medium text-danger">
            {failedEmails} email{failedEmails === 1 ? "" : "s"} failed
          </Link>
        )}
        <form action={logoutAction}>
          <button type="submit" className="text-muted underline-offset-4 hover:text-fg hover:underline">
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
