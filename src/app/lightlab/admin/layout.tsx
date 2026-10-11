import type { Metadata } from "next";
import Link from "next/link";
import { lightlab } from "@config/lightlab";
import { LightLabAdminNav } from "@/components/lightlab/admin/AdminNav";
import { LightLabLogo } from "@/components/lightlab/LightLabLogo";
import { requireAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = { title: { default: "Admin", template: `%s · LightLab admin` }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The LightLab shop admin. Same login as the Coastline admin. */
export default async function LightLabAdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin("/lightlab/admin");
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <LightLabLogo className="h-10" />
          <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted">Admin</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/lightlab" className="text-muted underline-offset-4 hover:text-fg hover:underline" target="_blank">
            View shop ↗
          </Link>
          <Link href="/admin" className="text-muted underline-offset-4 hover:text-fg hover:underline">
            Coastline admin
          </Link>
        </div>
      </div>
      <div className="mt-5">
        <LightLabAdminNav />
      </div>
      <p className="sr-only">{lightlab.name} admin</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}
