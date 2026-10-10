"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { logoutAction } from "@/app/admin/actions";
import { cn } from "@/lib/cn";

const links = [
  { href: "/admin", label: "Today" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/queues", label: "Printers" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/promote", label: "Promote" },
  { href: "/admin/codes", label: "Codes" },
  { href: "/admin/etransfers", label: "e-Transfers" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav({ failedEmails, etransferReview = 0 }: { failedEmails: number; etransferReview?: number }) {
  const path = usePathname();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Scrolls sideways on phones rather than wrapping */}
      <nav aria-label="Admin" className="-mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:rounded-full sm:border sm:border-line sm:bg-surface sm:p-1">
        {links.map((l) => {
          const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={cn("relative shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors sm:py-1.5", active ? "text-accent-ink" : "text-muted hover:text-fg")}>
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
          <Link href="/admin/orders?view=list&status=EMAIL_FAILED" className="rounded-full bg-danger/15 px-3 py-1 font-medium text-danger">
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
