"use client";
import { useState, useTransition } from "react";
import { pairKioskAction, setKioskModeAction, unpairKioskAction } from "@/app/lightlab/admin/kiosk/actions";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { money } from "@/lib/format";

type KioskRow = { id: string; name: string; mode: "shop" | "order"; lastSeen: string; salesToday: number; centsToday: number; salesAll: number };
type Problem = { id: string; when: string; totalCents: number; email: string; problem: string };

const input = "h-12 w-full rounded-xl border border-line bg-elev px-3 outline-none transition-[border-color,box-shadow] focus:border-accent-line focus:shadow-[0_0_0_4px_var(--accent-soft)]";

function ago(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "online now";
  if (s < 3600) return `seen ${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `seen ${Math.round(s / 3600)} h ago`;
  return `seen ${new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}`;
}

/** Pair a self-checkout tablet, see what each one sold today, and any paid sales that need sorting out. */
export function KioskAdmin({ kiosks, problems }: { kiosks: KioskRow[]; problems: Problem[] }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("Stand kiosk");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Self-checkout kiosk</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Open <strong className="font-mono text-fg">coastlineprints.ca/kiosk</strong> on a tablet at the stand. It shows a 6-letter code: type it here. Shoppers pick their lamps on the tablet and pay by scanning a QR code with their own phone (card, Apple Pay or Google Pay through Square). &ldquo;Take home now&rdquo; sells what&apos;s on the table; &ldquo;Order only&rdquo; takes orders made later, with the colours, names and ready-by day they pick. Both show up under Orders as &ldquo;LightLab kiosk&rdquo;.
        </p>
        <form
          className="mt-5 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setMsg(null);
            start(async () => {
              const r = await pairKioskAction(code, name);
              setMsg(r.ok ? { ok: true, text: "Paired. The tablet switches to the shop in a few seconds." } : { ok: false, text: r.error ?? "Couldn't pair." });
              if (r.ok) setCode("");
            });
          }}
        >
          <label className="block w-44">
            <span className="mb-1 block text-xs font-medium text-muted">Code on the tablet</span>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} className={`${input} text-center font-mono text-xl uppercase tracking-[0.25em]`} placeholder="ABC234" autoComplete="off" />
          </label>
          <label className="block w-56">
            <span className="mb-1 block text-xs font-medium text-muted">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={input} />
          </label>
          <Button type="submit" size="lg" disabled={pending || code.replace(/\W/g, "").length < 6}>
            {pending ? "Pairing…" : "Pair tablet"}
          </Button>
        </form>
        {msg && (
          <p role="status" className={`mt-3 text-sm ${msg.ok ? "text-success" : "text-danger"}`}>
            {msg.text}
          </p>
        )}
      </section>

      {problems.length > 0 && (
        <section className="rounded-3xl border border-danger/40 bg-danger/10 p-5">
          <h2 className="font-display text-lg font-semibold text-danger">Paid, but not saved</h2>
          <p className="mt-1 text-sm text-muted">These shoppers paid through Square, but the sale couldn&apos;t be recorded (usually a lamp sold out in between). Check Square, then ring them up on the register or refund.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {problems.map((p) => (
              <li key={p.id} className="rounded-xl bg-bg p-3">
                <span className="font-semibold">{money(p.totalCents)}</span> · {new Date(p.when).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                {p.email && <> · {p.email}</>}
                <span className="block text-muted">{p.problem}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-display text-lg font-semibold">Paired tablets</h2>
        {kiosks.length === 0 ? (
          <p className="mt-2 text-sm text-muted">None yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {kiosks.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{k.name}</p>
                  <p className="text-xs text-muted">{ago(k.lastSeen)}</p>
                </div>
                {/* What this tablet does: sell and take payment, or only take order requests. */}
                <div role="radiogroup" aria-label={`${k.name} mode`} className="flex rounded-full border border-line p-1 text-xs font-semibold">
                  {(["shop", "order"] as const).map((m) => (
                    <button key={m} type="button" role="radio" aria-checked={k.mode === m} disabled={pending} onClick={() => k.mode !== m && start(async () => void (await setKioskModeAction(k.id, m)))} className={cn("rounded-full px-3 py-1.5 transition-colors", k.mode === m ? "bg-accent text-accent-ink" : "text-muted hover:text-fg")}>
                      {m === "shop" ? "Take home now" : "Order only"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted">
                  Today: <span className="font-semibold text-fg">{k.salesToday}</span> {k.salesToday === 1 ? "sale" : "sales"} · {money(k.centsToday)}
                  <span className="block">{k.salesAll} in all</span>
                </p>
                <button
                  type="button"
                  className="text-xs text-muted underline-offset-4 hover:text-danger hover:underline"
                  onClick={() => confirm(`Unpair ${k.name}? It will stop taking sales until you pair it again.`) && start(async () => void (await unpairKioskAction(k.id)))}
                >
                  Unpair
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
