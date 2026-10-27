"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Logo } from "@/components/layout/Logo";
import { LightLabLogo } from "@/components/lightlab/LightLabLogo";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import type { PosScreen } from "@/lib/pos/types";

const PAY_HINT: Record<string, string> = {
  CARD: "Tap, insert or swipe on the card reader.",
  CASH: "Paying with cash.",
  ETRANSFER: "Paying by Interac e-Transfer.",
  OTHER: "Almost done.",
};

/**
 * What the customer sees, full screen on a tablet: a welcome, the cart as
 * it's rung up, an email box for their receipt, the total to pay, and a
 * thank you. Styled as LightLab (black and white) or Coastline Prints.
 */
export function CustomerScreen({ screen, onEmail, corner }: { screen: PosScreen; onEmail?: (email: string) => Promise<string | null>; corner?: React.ReactNode }) {
  const lightlab = screen.brand === "lightlab";
  return (
    <div className={cn("fixed inset-0 z-[200] flex flex-col overflow-hidden bg-bg text-fg", lightlab && "lightlab-theme")}>
      <header className="flex items-center justify-between px-8 pt-6">
        {lightlab ? <LightLabLogo className="h-12" /> : <Logo />}
        {corner}
      </header>
      <AnimatePresence mode="wait">
        <motion.main
          key={screen.stage}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="flex min-h-0 flex-1 flex-col px-8 pb-8 pt-4"
        >
          {screen.stage === "idle" ? <Welcome lightlab={lightlab} /> : screen.stage === "done" ? <Thanks screen={screen} lightlab={lightlab} /> : <Cart screen={screen} onEmail={onEmail} />}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}

function Welcome({ lightlab }: { lightlab: boolean }) {
  return (
    <div className="m-auto text-center">
      <p className="font-display text-5xl font-bold tracking-tight sm:text-6xl">Hi there!</p>
      <p className={cn("mt-4 text-2xl", lightlab ? "ll-accent text-3xl" : "text-muted")}>{lightlab ? "lamps made in victoria, b.c." : "Your items will show up here."}</p>
    </div>
  );
}

type Shown = Extract<PosScreen, { lines: unknown }>;

function Cart({ screen, onEmail }: { screen: Shown; onEmail?: (email: string) => Promise<string | null> }) {
  const count = screen.lines.reduce((n, l) => n + l.quantity, 0);
  return (
    <div className="grid min-h-0 flex-1 gap-8 md:grid-cols-[1fr_minmax(320px,0.8fr)]">
      <section className="flex min-h-0 flex-col">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
          Your order · {count} item{count === 1 ? "" : "s"}
        </h2>
        <ul className="mt-3 min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          <AnimatePresence initial={false}>
            {screen.lines.map((l) => (
              <motion.li key={l.key} layout initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} className="flex items-baseline justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-xl font-medium">
                    {l.quantity > 1 && <span className="text-muted">{l.quantity} × </span>}
                    {l.name}
                  </p>
                  {l.detail && <p className="truncate text-muted">{l.detail}</p>}
                </div>
                <span className="shrink-0 font-mono text-xl">{l.cents == null ? "" : money(l.cents)}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </section>

      <section className="flex flex-col justify-end gap-4 rounded-3xl border border-line bg-surface p-6">
        <p className={cn("mb-auto", screen.brand === "lightlab" ? "ll-accent text-3xl" : "font-display text-2xl font-semibold")}>{screen.brand === "lightlab" ? "thanks for shopping local" : "Thanks for shopping local!"}</p>
        <dl className="space-y-2 text-lg">
          {screen.fees.map((f) => (
            <Line key={f.label} label={f.label} value={money(f.cents)} />
          ))}
          {screen.discounts.map((d) => (
            <Line key={d.label} label={d.label} value={`−${money(d.cents)}`} />
          ))}
        </dl>
        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <span className="text-xl font-semibold">Total</span>
          <motion.span key={screen.totalCents} initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 420, damping: 22 }} className="font-display text-5xl font-bold tabular-nums">
            {money(screen.totalCents)}
          </motion.span>
        </div>
        {screen.stage === "pay" && <PayNote screen={screen} />}
        {screen.stage === "email" && <EmailBox initial={screen.email ?? ""} onEmail={onEmail} />}
        {screen.stage === "cart" && screen.email && <p className="text-muted">Receipt goes to {screen.email}</p>}
      </section>
    </div>
  );
}

function PayNote({ screen }: { screen: Shown }) {
  const change = screen.payment === "CASH" && screen.tenderedCents != null ? screen.tenderedCents - screen.totalCents : null;
  return (
    <div className="rounded-2xl bg-accent-soft p-4 text-lg">
      <p>{PAY_HINT[screen.payment ?? "OTHER"]}</p>
      {change != null && change >= 0 && (
        <p className="mt-1 text-muted">
          Cash {money(screen.tenderedCents!)} · Change <span className="font-semibold text-fg">{money(change)}</span>
        </p>
      )}
    </div>
  );
}

function EmailBox({ initial, onEmail }: { initial: string; onEmail?: (email: string) => Promise<string | null> }) {
  const [email, setEmail] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function send(value: string) {
    if (!onEmail) return;
    setBusy(true);
    setError(await onEmail(value));
    setBusy(false);
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send(email.trim());
      }}
      className="space-y-3"
    >
      <label className="block text-lg font-medium" htmlFor="pos-email">
        Want your receipt by email?
      </label>
      <input
        id="pos-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        autoFocus
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="h-14 w-full rounded-full border-2 border-line bg-bg px-5 text-lg outline-none focus:border-accent-line"
      />
      {error && <p className="text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="lg" className="flex-1" disabled={busy || !email.trim()}>
          Send it to me
        </Button>
        <Button variant="ghost" size="lg" disabled={busy} onClick={() => send("")}>
          No thanks
        </Button>
      </div>
      <p className="text-sm text-faint">Only for your receipt and order updates.</p>
    </form>
  );
}

function Thanks({ screen, lightlab }: { screen: Shown; lightlab: boolean }) {
  return (
    <div className="m-auto text-center">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 16 }} className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-accent text-5xl text-accent-ink">
        ✓
      </motion.div>
      <p className="mt-6 font-display text-5xl font-bold tracking-tight">Thank you!</p>
      {lightlab && <p className="ll-accent mt-3 text-3xl">enjoy the glow</p>}
      <p className="mt-4 text-xl text-muted">
        Order <span className="font-mono text-fg">{screen.orderNumber}</span>
        {screen.emailed ? " · your receipt is on its way" : ""}
      </p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-muted">
      <dt>{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
