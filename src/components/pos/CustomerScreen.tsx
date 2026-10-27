"use client";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { useState } from "react";
import { Logo } from "@/components/layout/Logo";
import { LightLabLogo } from "@/components/lightlab/LightLabLogo";
import { OneLineLamps } from "@/components/lightlab/hero/OneLineLamps";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import type { PosPopup, PosReply, PosScreen } from "@/lib/pos/types";
import { POINTS_PER_DOLLAR } from "@config/rewards";
import { AnimatedMoney, DrawnCheck, Qr, Thumb } from "./bits";

export type ReplyFn = (answer: { popupId: string; kind: PosReply["kind"]; email?: string; name?: string }) => Promise<string | null>;

const PAY_HINT: Record<string, string> = {
  CARD: "Tap, insert or swipe on the card reader.",
  CASH: "Paying with cash.",
  ETRANSFER: "Paying by Interac e-Transfer.",
  LINK: "Paying on your phone.",
  OTHER: "Almost done.",
};

/**
 * What the customer sees, full screen on a tablet, always dark: a welcome
 * with a moving picture, the cart with photos as it's rung up, popups the
 * cashier sends (receipt email, join rewards, pay by QR, e-Transfer details,
 * links to scan, a note), and a thank you. LightLab or Coastline styling.
 */
export function CustomerScreen({ screen, onReply, corner }: { screen: PosScreen; onReply?: ReplyFn; corner?: React.ReactNode }) {
  const lightlab = screen.brand === "lightlab";
  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("fixed inset-0 z-[200] flex flex-col overflow-hidden bg-bg text-fg", lightlab && "lightlab-theme")}>
        <header className="relative z-10 flex items-center justify-between px-8 pt-6">
          {lightlab ? <LightLabLogo className="h-12" /> : <Logo />}
          {corner}
        </header>
        <AnimatePresence mode="wait">
          <motion.main
            key={`${screen.stage}-${screen.brand}`}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex min-h-0 flex-1 flex-col px-8 pb-8 pt-4"
          >
            {screen.stage === "idle" ? <Welcome lightlab={lightlab} /> : screen.stage === "done" ? <Thanks screen={screen} lightlab={lightlab} /> : <Cart screen={screen} lightlab={lightlab} />}
          </motion.main>
        </AnimatePresence>
        <PopupLayer popup={screen.popup ?? null} onReply={onReply} />
      </div>
    </MotionConfig>
  );
}

function Welcome({ lightlab }: { lightlab: boolean }) {
  if (lightlab) {
    return (
      <div className="m-auto flex w-full max-w-4xl flex-col items-center gap-6 md:flex-row md:gap-12">
        <div className="h-[42vh] w-full max-w-sm">
          <OneLineLamps />
        </div>
        <div className="text-center md:text-left">
          <p className="font-display text-6xl font-bold tracking-tight">Hi there!</p>
          <p className="ll-accent mt-4 text-4xl">Ready to Check out?</p>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="m-auto text-center">
        <motion.p initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 18 }} className="font-display text-6xl font-bold tracking-tight">
          Hi there!
        </motion.p>
        <p className="mt-4 text-2xl text-muted">Your items will show up here as they&apos;re rung up.</p>
      </div>
      <Waves />
    </>
  );
}

/** Coastline's sea along the bottom: two bands sliding by exactly one wave each loop, so they never jump. */
function Waves() {
  const band = (y: number, amp: number) => {
    let d = `M0 ${y}`;
    for (let x = 0; x < 2400; x += 200) d += ` q50 ${-amp} 100 0 t100 0`;
    return `${d} V200 H0 Z`;
  };
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 overflow-hidden" aria-hidden>
      {[
        { y: 60, amp: 16, fill: "#86bbea", seconds: 16, opacity: 0.22 },
        { y: 100, amp: 20, fill: "#0e4471", seconds: 10 },
      ].map((w) => (
        <motion.svg key={w.y} viewBox="0 0 2400 200" preserveAspectRatio="none" className="absolute bottom-0 left-0 h-full w-[200%]" style={{ opacity: w.opacity ?? 1 }} animate={{ x: ["0%", "-8.3333%"] }} transition={{ duration: w.seconds, ease: "linear", repeat: Infinity }}>
          <path d={band(w.y, w.amp)} fill={w.fill} />
        </motion.svg>
      ))}
    </div>
  );
}

function Cart({ screen, lightlab }: { screen: PosScreen; lightlab: boolean }) {
  const lines = screen.lines ?? [];
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const change = screen.payment === "CASH" && screen.tenderedCents != null ? screen.tenderedCents - (screen.totalCents ?? 0) : null;
  return (
    <div className="grid min-h-0 flex-1 gap-8 md:grid-cols-[1fr_minmax(340px,0.8fr)]">
      <section className="flex min-h-0 flex-col">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
          Your order · <AnimatedCountText n={count} /> item{count === 1 ? "" : "s"}
        </h2>
        <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {lines.map((l) => (
              <motion.li
                key={l.key}
                layout
                initial={{ opacity: 0, x: 40, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -30, height: 0, marginTop: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="flex items-center gap-4 rounded-2xl bg-surface p-3"
              >
                <motion.span initial={{ scale: 0.5, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 18, delay: 0.05 }}>
                  <Thumb line={l} size="lg" />
                </motion.span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xl font-medium">{l.name}</p>
                  {l.detail && <p className="truncate text-muted">{l.detail}</p>}
                </div>
                <motion.span key={l.quantity} initial={{ scale: 1.5 }} animate={{ scale: 1 }} className="rounded-full bg-surface-strong px-3 py-1 font-mono text-lg">
                  ×{l.quantity}
                </motion.span>
                <span className="w-28 shrink-0 text-right font-mono text-xl">{l.cents == null ? "" : money(l.cents)}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </section>

      <section className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6">
        <p className={cn("mb-auto", lightlab ? "ll-accent text-3xl" : "font-display text-2xl font-semibold")}>{lightlab ? "thanks for shopping local" : "Thanks for shopping local!"}</p>
        <dl className="space-y-2 text-lg">
          {screen.fees?.map((f) => <Line key={f.label} label={f.label} value={money(f.cents)} />)}
          {screen.discounts?.map((d) => <Line key={d.label} label={d.label} value={`−${money(d.cents)}`} good />)}
        </dl>
        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <span className="text-xl font-semibold">Total</span>
          <AnimatedMoney cents={screen.totalCents ?? 0} className="font-display text-6xl font-bold" />
        </div>
        <AnimatePresence>
          {screen.payment && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden rounded-2xl bg-accent-soft p-4 text-lg">
              <p>{PAY_HINT[screen.payment]}</p>
              {change != null && change >= 0 && (
                <p className="mt-1 text-muted">
                  Cash {money(screen.tenderedCents!)} · Change <span className="font-semibold text-fg">{money(change)}</span>
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {screen.email && <p className="text-muted">Receipt goes to {screen.email}</p>}
      </section>
    </div>
  );
}

function Thanks({ screen, lightlab }: { screen: PosScreen; lightlab: boolean }) {
  return (
    <div className="relative m-auto text-center">
      {/* Rings that ripple out once. */}
      {[0, 0.25, 0.5].map((d) => (
        <motion.span key={d} className="absolute left-1/2 top-12 -ml-12 -mt-12 h-24 w-24 rounded-full border-2 border-accent-line" initial={{ scale: 0.6, opacity: 0.8 }} animate={{ scale: 3.2, opacity: 0 }} transition={{ duration: 1.6, delay: d, ease: "easeOut" }} aria-hidden />
      ))}
      <motion.div initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className="relative mx-auto h-24 w-24 text-accent-text">
        <DrawnCheck className="h-full w-full" />
      </motion.div>
      <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-6 font-display text-6xl font-bold tracking-tight">
        Thank you!
      </motion.p>
      {lightlab && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="ll-accent mt-3 text-4xl">
          enjoy the glow
        </motion.p>
      )}
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="mt-5 text-xl text-muted">
        Order <span className="font-mono text-fg">{screen.orderNumber}</span>
        {screen.emailed ? ` · receipt sent to ${screen.email ?? "your email"}` : ""}
      </motion.p>
    </div>
  );
}

/** The cashier's popup, over everything. */
function PopupLayer({ popup, onReply }: { popup: PosPopup | null; onReply?: ReplyFn }) {
  return (
    <AnimatePresence>
      {popup && (
        <motion.div key={popup.id} className="fixed inset-0 z-[250] grid place-items-center p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" aria-hidden />
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="relative w-full max-w-xl rounded-[32px] border border-line bg-elev p-8 shadow-2xl"
          >
            <PopupBody popup={popup} onReply={onReply} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PopupBody({ popup, onReply }: { popup: PosPopup; onReply?: ReplyFn }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send(kind: PosReply["kind"], fields: { email?: string; name?: string } = {}) {
    if (!onReply) return;
    setBusy(true);
    setError(await onReply({ popupId: popup.id, kind, ...fields }));
    setBusy(false);
  }
  const done = (
    <Button size="lg" className="mt-6 w-full" disabled={busy} onClick={() => send("dismiss")}>
      Done
    </Button>
  );

  switch (popup.kind) {
    case "email":
      return <EmailForm busy={busy} error={error} title="Want your receipt by email?" note="Only for your receipt and order updates." submit="Send it to me" onSubmit={(email) => send("email", { email })} onSkip={() => send("dismiss")} />;
    case "account":
      return (
        <EmailForm
          busy={busy}
          error={error}
          withName
          title="Join Coastline Rewards"
          note={`Earn ${POINTS_PER_DOLLAR} points for every $1, today included. We'll email you a link to sign in. No password needed.`}
          submit="Join"
          onSubmit={(email, name) => send("account", { email, name })}
          onSkip={() => send("dismiss")}
        />
      );
    case "card-link":
      return (
        <div className="text-center">
          <AnimatePresence mode="wait">
            {popup.paid ? (
              <motion.div key="paid" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-6">
                <DrawnCheck className="mx-auto h-28 w-28 text-success" />
                <p className="mt-4 font-display text-4xl font-bold">Paid!</p>
                <p className="mt-2 text-lg text-muted">{money(popup.amountCents)} received. Thank you!</p>
              </motion.div>
            ) : (
              <motion.div key="scan" exit={{ scale: 0.9, opacity: 0 }}>
                <p className="font-display text-3xl font-bold">Scan to pay {money(popup.amountCents)}</p>
                <p className="mt-2 text-lg text-muted">Card, Apple Pay or Google Pay, on your phone</p>
                <div className="relative mx-auto mt-6 w-72 overflow-hidden rounded-[24px] border-2 border-[#86bbea] bg-white p-2">
                  <Qr value={popup.url} className="w-full" />
                  {/* A scanner line gliding down and back, eased at both ends so it never snaps. */}
                  <motion.span className="absolute inset-x-3 h-1 rounded-full bg-[#86bbea] opacity-80" initial={{ top: "6%" }} animate={{ top: "92%" }} transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }} aria-hidden />
                </div>
                <p className="mt-5 flex items-center justify-center gap-2 text-muted">
                  <motion.span className="h-2.5 w-2.5 rounded-full bg-accent-text" animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
                  Waiting for payment
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    case "etransfer":
      return (
        <div>
          <p className="font-display text-3xl font-bold">Send an Interac e-Transfer</p>
          <p className="mt-1 text-lg text-muted">From your banking app, then show us the confirmation.</p>
          <dl className="mt-6 space-y-3">
            <Detail label="Send to" value={popup.sendTo} big />
            <Detail label="Amount" value={money(popup.amountCents)} big />
            <Detail label="Message" value={popup.message} mono />
          </dl>
        </div>
      );
    case "qr":
      return (
        <div className="text-center">
          <p className="font-display text-3xl font-bold">{popup.title}</p>
          {popup.text && <p className="mt-2 text-lg text-muted">{popup.text}</p>}
          <motion.div initial={{ rotate: -4, scale: 0.9 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }} className="mx-auto mt-6 w-64">
            <Qr value={popup.url} className="w-full" />
          </motion.div>
          <p className="mt-3 text-faint">Point your phone&apos;s camera at the code</p>
          {done}
        </div>
      );
    case "message":
      return (
        <div className="text-center">
          <p className="font-display text-4xl font-bold">{popup.title}</p>
          {popup.text && <p className="mt-3 whitespace-pre-wrap text-xl text-muted">{popup.text}</p>}
          {done}
        </div>
      );
  }
}

function EmailForm({ title, note, submit, withName, busy, error, onSubmit, onSkip }: { title: string; note: string; submit: string; withName?: boolean; busy: boolean; error: string | null; onSubmit: (email: string, name: string) => void; onSkip: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const field = "h-16 w-full rounded-full border-2 border-line bg-bg px-6 text-xl outline-none transition-colors focus:border-accent-line";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(email.trim(), name.trim());
      }}
      className="space-y-4"
    >
      <p className="font-display text-3xl font-bold">{title}</p>
      {withName && <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" autoComplete="given-name" maxLength={100} aria-label="Your name" />}
      <input className={field} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Your email" />
      <AnimatePresence>{error && <motion.p initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }} className="text-lg text-danger">{error}</motion.p>}</AnimatePresence>
      <div className="flex gap-3">
        <Button type="submit" size="lg" className="flex-1" disabled={busy || !email.trim()}>
          {busy ? "One sec..." : submit}
        </Button>
        <Button variant="ghost" size="lg" disabled={busy} onClick={onSkip}>
          No thanks
        </Button>
      </div>
      <p className="text-faint">{note}</p>
    </form>
  );
}

function Detail({ label, value, big, mono }: { label: string; value: string; big?: boolean; mono?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <dt className="text-sm font-semibold uppercase tracking-[0.12em] text-faint">{label}</dt>
      <dd className={cn("mt-1 break-all", big ? "text-2xl font-semibold" : "text-xl", mono && "font-mono")}>{value}</dd>
    </div>
  );
}

function Line({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex justify-between gap-4", good ? "text-success" : "text-muted")}>
      <dt>{label}</dt>
      <dd className="font-mono">{value}</dd>
    </motion.div>
  );
}

function AnimatedCountText({ n }: { n: number }) {
  return (
    <motion.span key={n} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="inline-block">
      {n}
    </motion.span>
  );
}
