"use client";
import { useState, useTransition } from "react";
import { pairKioskAction, saveCardFeeAction, setKioskModeAction, unpairKioskAction } from "@/app/lightlab/admin/kiosk/actions";
import { cardFeeFor, type CardFeeSettings } from "@/lib/pos/card-fee";
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
export function KioskAdmin({ kiosks, problems, cardFee }: { kiosks: KioskRow[]; problems: Problem[]; cardFee: CardFeeSettings }) {
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

      <CardFeeCard initial={cardFee} />

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

/** Switch the card processing fee on or off for Square links, and set what it covers. */
function CardFeeCard({ initial }: { initial: CardFeeSettings }) {
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = (next: CardFeeSettings) => {
    setS(next);
    setMsg(null);
    start(async () => {
      const r = await saveCardFeeAction(next);
      setMsg(r.error ?? "Saved.");
    });
  };
  const example = cardFeeFor(5000, s);
  return (
    <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="font-display text-lg font-semibold">Card processing fee</h2>
          <p className="mt-1 text-sm text-muted">Adds Square&apos;s fee to the total whenever someone pays through a Square QR link: the kiosk, and Scan to pay on the register (you can waive it per sale there). It shows as its own line, &ldquo;Card processing fee&rdquo;, with a note saying it covers Square&apos;s charge.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={s.on} disabled={pending} onChange={(e) => save({ ...s, on: e.target.checked })} className="h-5 w-5 accent-[var(--accent)]" />
          {s.on ? "On" : "Off"}
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="block w-28">
          <span className="mb-1 block text-xs text-muted">Percent</span>
          <input type="number" step="0.1" min={0} max={10} value={s.percent} onChange={(e) => setS({ ...s, percent: Number(e.target.value) })} onBlur={() => save(s)} className={input} />
        </label>
        <label className="block w-28">
          <span className="mb-1 block text-xs text-muted">Plus (cents)</span>
          <input type="number" min={0} max={500} value={s.fixedCents} onChange={(e) => setS({ ...s, fixedCents: Math.round(Number(e.target.value)) })} onBlur={() => save(s)} className={input} />
        </label>
        <p className="pb-3 text-muted">On a $50.00 sale the fee is {money(example)}.</p>
      </div>
      <p className="mt-3 rounded-xl bg-bg p-3 text-xs text-muted">
        Canadian card rules: Visa and Mastercard allow a surcharge on <strong>credit</strong> cards only, up to <strong>2.4%</strong>, after you notify your processor at least 30 days ahead. Debit can&apos;t be surcharged, and Quebec doesn&apos;t allow it. A Square link can&apos;t tell credit from debit before paying, so check with Square before switching this on.
      </p>
      {msg && <p className="mt-2 text-sm text-muted">{msg}</p>}
    </section>
  );
}
