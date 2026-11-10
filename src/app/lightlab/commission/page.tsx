import type { Metadata } from "next";
import Link from "next/link";
import { CommissionForm } from "@/components/lightlab/commission/CommissionForm";
import { getEffectiveConfig } from "@/lib/config/effective";
import { COMMISSION } from "@/lib/commissions/server";

export const metadata: Metadata = { title: "Make me a lamp", description: "Commission a one-of-a-kind LightLab lamp: send your idea and a photo, pick a shade colour, and get a quote." };
export const dynamic = "force-dynamic";

export default async function CommissionPage() {
  const cfg = await getEffectiveConfig();
  // The shade colours in stock right now (one of each name).
  const seen = new Set<string>();
  const shades = cfg.materials
    .filter((m) => m.id === "PLA" || m.id === "PETG")
    .flatMap((m) => m.colors.filter((c) => c.available))
    .filter((c) => !seen.has(c.name) && seen.add(c.name))
    .map((c) => ({ name: c.name.replace(/^(Tinmorry|Elegoo) /, ""), hex: c.hex }));
  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
      <Link href="/lightlab" className="ll-link text-sm text-muted hover:text-fg">
        ← LightLab
      </Link>
      <p className="ll-accent mt-8 text-3xl">one of a kind</p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">Make me a lamp</h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">Got a character, a pet, an inside joke or a shape in mind? Tell us about it, add a photo if you have one, and pick a shade colour. We&apos;ll send you a price. Nothing to pay until you say yes.</p>
      <ol className="mt-8 grid gap-3 text-sm sm:grid-cols-3">
        {["Send your idea", "Get a quote by email", "Say yes, pay, and we make it"].map((s, i) => (
          <li key={s} className="flex items-center gap-3 rounded-2xl border border-line p-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent font-semibold text-accent-ink">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <CommissionForm shades={shades} maxPhotos={COMMISSION.maxPhotos} maxPhotoMb={COMMISSION.maxPhotoMb} />
    </div>
  );
}
