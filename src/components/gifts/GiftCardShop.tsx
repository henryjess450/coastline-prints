"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { PaymentMethods, type PaymentMethodsHandle, type SquareConfig } from "@/components/checkout/PaymentMethods";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { bounce, Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { friendlyDate, GIFT_MAX_CENTS, GIFT_MESSAGE_MAX, GIFT_MIN_CENTS, GIFT_PRESETS_CENTS, giftDetailsSchema, type GiftDetails } from "@/lib/giftcards/rules";
import { GiftAnimation, type PayResult } from "./GiftAnimation";
import { GiftSent } from "./GiftSent";

type Fields = { recipientName: string; recipientEmail: string; message: string; buyerName: string; buyerEmail: string };
type Errors = Partial<Record<keyof GiftDetails | "custom", string>>;
type Outcome = { ok: true; recipientName: string; sendOn: string | null } | { ok: false; message: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const formatTotal = (v: number) => money(Math.round(v));

/**
 * Buy a gift card: amount, who it's for, a message, who it's from, and when
 * to send it. Pressing Pay checks the card, then the packing animation plays
 * while the payment goes through, ending on the confirmation.
 * `demo` (development only) skips Square so the animation can be previewed.
 */
export function GiftCardShop({ square, range, demo = false }: { square: SquareConfig | null; range: { min: string; max: string }; demo?: boolean }) {
  const payRef = useRef<PaymentMethodsHandle>(null);
  const payButton = useRef<HTMLButtonElement>(null);
  const [preset, setPreset] = useState<number | "custom">(5000);
  const [custom, setCustom] = useState("");
  const [fields, setFields] = useState<Fields>({ recipientName: "", recipientEmail: "", message: "", buyerName: "", buyerEmail: "" });
  const [schedule, setSchedule] = useState(false);
  const [sendOn, setSendOn] = useState(range.min);
  const [errors, setErrors] = useState<Errors>({});
  const [payError, setPayError] = useState<{ message: string; n: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const [phase, setPhase] = useState<"form" | "sending" | "sent">("form");
  const [result, setResult] = useState<PayResult>("pending");
  const [sent, setSent] = useState<{ recipientName: string; sendOn: string | null } | null>(null);
  const attempt = useRef<string | null>(null);

  const customCents = Math.round(Number(custom.replace(/[$,\s]/g, "")) * 100);
  const amountCents = preset === "custom" ? (Number.isFinite(customCents) ? customCents : 0) : preset;
  const canPay = (!!square || demo) && !checking && phase === "form";

  const set = (k: keyof Fields, v: string) => {
    setFields((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  function validate(): GiftDetails | null {
    const r = giftDetailsSchema.safeParse({ ...fields, amountCents, sendOn: schedule ? sendOn : null });
    const next: Errors = {};
    if (!r.success) for (const issue of r.error.issues) next[issue.path[0] as keyof GiftDetails] ??= issue.message;
    if (schedule && (sendOn < range.min || sendOn > range.max)) next.sendOn = "Pick a day between tomorrow and a year from now.";
    if (next.amountCents && preset === "custom") next.custom = next.amountCents;
    setErrors(next);
    const firstBad = Object.keys(next)[0];
    if (firstBad) {
      document.getElementById(`gift-${firstBad === "amountCents" ? "custom" : firstBad}`)?.focus();
      return null;
    }
    return r.success ? r.data : null;
  }

  function fail(message: string) {
    setChecking(false);
    setPayError((p) => ({ message, n: (p?.n ?? 0) + 1 }));
  }

  /** Charges the card. One automatic retry on a lost connection; the attempt id makes that safe. */
  const pay = useCallback(async (details: GiftDetails, sourceId: string, attemptId: string): Promise<Outcome> => {
    if (demo) {
      await sleep(1800);
      return { ok: true, recipientName: details.recipientName, sendOn: details.sendOn };
    }
    const body = JSON.stringify({ ...details, attemptId, sourceId, expectedTotalCents: details.amountCents });
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await fetch("/api/gift-cards", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      } catch {
        if (attempt === 0) {
          await sleep(1500);
          continue;
        }
        return { ok: false, message: "We lost the connection while paying. Check your email for a receipt before trying again." };
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === "paid") return { ok: true, recipientName: data.recipientName, sendOn: data.sendOn };
      if (res.status === 202) {
        for (let i = 0; i < 30; i++) {
          await sleep(2000);
          const poll = await fetch(`/api/gift-cards/${attemptId}`).then((r) => (r.ok ? r.json() : null), () => null);
          if (poll?.status === "paid") return { ok: true, recipientName: poll.recipientName, sendOn: poll.sendOn };
          if (poll?.status === "failed") return { ok: false, message: "The payment didn't go through. Your card was not charged." };
        }
        return { ok: false, message: "Your payment is still processing. You'll get an email receipt as soon as it completes." };
      }
      if (res.status === 503 && data.retryable && attempt === 0) {
        await sleep(1500);
        continue;
      }
      return { ok: false, message: data.error ?? "The payment didn't go through. Your card was not charged." };
    }
    return { ok: false, message: "The payment didn't go through. Your card was not charged." };
  }, [demo]);

  /** Card checked: start the animation and the payment together. */
  async function send(details: GiftDetails, sourceId: string) {
    setChecking(false);
    setResult("pending");
    setPhase("sending");
    window.scrollTo({ top: 0, behavior: "smooth" });
    attempt.current = crypto.randomUUID();
    const outcome = await pay(details, sourceId, attempt.current);
    if (outcome.ok) {
      setSent({ recipientName: outcome.recipientName, sendOn: outcome.sendOn });
      setResult("paid");
    } else {
      setResult("failed");
      setPhase("form");
      fail(outcome.message);
    }
  }

  async function payWithCard() {
    setPayError(null);
    const details = validate();
    if (!details) return;
    if (demo) return send(details, "demo");
    if (!payRef.current) return;
    setChecking(true);
    const [givenName, ...rest] = details.buyerName.split(/\s+/);
    try {
      const token = await payRef.current.tokenizeCard({
        amount: (details.amountCents / 100).toFixed(2),
        currencyCode: "CAD",
        intent: "CHARGE",
        billingContact: { givenName, familyName: rest.join(" ") || undefined, email: details.buyerEmail, countryCode: "CA" },
        customerInitiated: true,
        sellerKeyedIn: false,
      });
      await send(details, token);
    } catch (err) {
      fail(err instanceof Error ? err.message : "Please check your card details.");
    }
  }

  function payWithWallet(token: string) {
    setPayError(null);
    const details = validate();
    if (!details) return fail("Please fill in the gift details first, then try again.");
    void send(details, token);
  }

  function another() {
    setFields((f) => ({ ...f, recipientName: "", recipientEmail: "", message: "" }));
    setSchedule(false);
    setSent(null);
    setPhase("form");
  }

  // The Pay button hops once the form is filled in enough to send.
  const ready = amountCents >= GIFT_MIN_CENTS && amountCents <= GIFT_MAX_CENTS && !!fields.recipientName && /@/.test(fields.recipientEmail) && !!fields.buyerName && /@/.test(fields.buyerEmail);
  const wasReady = useRef(ready);
  useEffect(() => {
    if (ready && !wasReady.current) bounce(payButton.current);
    wasReady.current = ready;
  }, [ready]);

  // The Benchy has sailed: send the gift emails now and show the confirmation.
  const onDone = useCallback(() => {
    if (attempt.current && !demo)
      void fetch("/api/sendoff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gift: attempt.current }), keepalive: true }).catch(() => undefined);
    setPhase("sent");
  }, [demo]);

  // Full-screen animation over the whole page while the gift is sent.
  if (phase === "sending") return <GiftAnimation result={result} amount={money(amountCents)} onDone={onDone} />;
  if (phase === "sent" && sent) return <GiftSent recipientName={sent.recipientName} when={sent.sendOn ? friendlyDate(sent.sendOn) : null} onAnother={another} />;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12">
      <div className="min-w-0 space-y-6">
        <Card flat className="p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">Amount</h2>
          <div role="radiogroup" aria-label="Gift card amount" className="mt-5 flex flex-wrap gap-3">
            {GIFT_PRESETS_CENTS.map((c, i) => (
              <Chip key={c} active={preset === c} onClick={() => setPreset(c)} delay={i * 0.04}>
                {money(c).replace(".00", "")}
              </Chip>
            ))}
            <Chip active={preset === "custom"} onClick={() => setPreset("custom")} delay={0.16}>
              Custom
            </Chip>
          </div>
          <AnimatePresence initial={false}>
            {preset === "custom" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <Field id="gift-custom" label={`Amount (${money(GIFT_MIN_CENTS).replace(".00", "")} to ${money(GIFT_MAX_CENTS).replace(".00", "")})`} error={errors.custom} className="mt-5 max-w-xs">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">$</span>
                    <input id="gift-custom" inputMode="decimal" value={custom} onChange={(e) => (setCustom(e.target.value), setErrors((x) => ({ ...x, custom: undefined, amountCents: undefined })))} placeholder="40" className={cn(inputClass(errors.custom), "pl-7")} />
                  </div>
                </Field>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        <Card flat className="p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">Who&apos;s it for?</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field id="gift-recipientName" label="Their name" error={errors.recipientName}>
              <input id="gift-recipientName" autoComplete="off" value={fields.recipientName} onChange={(e) => set("recipientName", e.target.value)} className={inputClass(errors.recipientName)} />
            </Field>
            <Field id="gift-recipientEmail" label="Their email" error={errors.recipientEmail}>
              <input id="gift-recipientEmail" type="email" autoComplete="off" value={fields.recipientEmail} onChange={(e) => set("recipientEmail", e.target.value)} className={inputClass(errors.recipientEmail)} />
            </Field>
            <Field id="gift-message" label="Personal message (optional)" error={errors.message} className="sm:col-span-2">
              <textarea id="gift-message" rows={3} maxLength={GIFT_MESSAGE_MAX} value={fields.message} onChange={(e) => set("message", e.target.value)} placeholder="Happy birthday! Print something awesome." className={cn(inputClass(errors.message), "h-auto py-2.5")} />
              <span className="mt-1 block text-right text-xs tabular-nums text-faint">
                {fields.message.length}/{GIFT_MESSAGE_MAX}
              </span>
            </Field>
          </div>
        </Card>

        <Card flat className="p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">From you</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">We&apos;ll send your receipt here, with a copy of the card.</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field id="gift-buyerName" label="Your name" error={errors.buyerName}>
              <input id="gift-buyerName" autoComplete="name" value={fields.buyerName} onChange={(e) => set("buyerName", e.target.value)} className={inputClass(errors.buyerName)} />
            </Field>
            <Field id="gift-buyerEmail" label="Your email" error={errors.buyerEmail}>
              <input id="gift-buyerEmail" type="email" autoComplete="email" value={fields.buyerEmail} onChange={(e) => set("buyerEmail", e.target.value)} className={inputClass(errors.buyerEmail)} />
            </Field>
          </div>
        </Card>

        <Card flat className="p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">When should it arrive?</h2>
          <div role="radiogroup" aria-label="Delivery" className="mt-5 flex flex-wrap gap-3">
            <Chip active={!schedule} onClick={() => setSchedule(false)}>
              Send it now
            </Chip>
            <Chip active={schedule} onClick={() => setSchedule(true)}>
              Pick a date
            </Chip>
          </div>
          <AnimatePresence initial={false}>
            {schedule && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <Field id="gift-sendOn" label="Delivery date" error={errors.sendOn} className="mt-5 max-w-xs">
                  <input id="gift-sendOn" type="date" min={range.min} max={range.max} value={sendOn} onChange={(e) => (setSendOn(e.target.value), setErrors((x) => ({ ...x, sendOn: undefined })))} className={inputClass(errors.sendOn)} />
                </Field>
                {sendOn >= range.min && sendOn <= range.max && <p className="mt-3 text-sm text-muted">It arrives at 9 am Pacific on {friendlyDate(sendOn)}.</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        <Card flat className="relative overflow-hidden p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">Payment</h2>
          <div className="mt-5">
            {demo ? (
              <p className="rounded-xl border border-sand/50 bg-sand/10 p-3 text-sm">Demo mode (development only): no card is charged.</p>
            ) : square ? (
              <PaymentMethods ref={payRef} config={square} totalCents={amountCents} disabled={!canPay} onWalletToken={payWithWallet} onWalletError={fail} />
            ) : (
              <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">Online payments aren&apos;t set up yet.</p>
            )}
          </div>
          <AnimatePresence>
            {payError && (
              <motion.div key={payError.n} role="alert" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0, x: [0, -10, 10, -6, 6, 0] }} exit={{ opacity: 0 }} transition={{ x: { duration: 0.45 } }} className="mt-4 flex gap-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
                <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-danger font-bold text-white">
                  !
                </span>
                <span>{payError.message}</span>
              </motion.div>
            )}
          </AnimatePresence>
          <Button ref={payButton} size="lg" className="mt-6 w-full" disabled={!canPay} onClick={payWithCard}>
            {checking ? "Checking your card…" : `Pay ${amountCents >= GIFT_MIN_CENTS ? money(amountCents) : ""} and send`}
          </Button>
        </Card>
      </div>

      {/* Live preview of the card: first on phones, beside the form on wide screens */}
      <div className="-order-1 min-w-0 lg:order-none lg:sticky lg:top-24 lg:self-start">
        <CardPreview amountCents={amountCents} to={fields.recipientName} from={fields.buyerName} message={fields.message} />
      </div>
    </div>
  );
}

function CardPreview({ amountCents, to, from, message }: { amountCents: number; to: string; from: string; message: string }) {
  return (
    <div>
      <motion.div className="relative aspect-[1.586] w-full rounded-3xl bg-accent p-6 text-accent-ink shadow-[var(--shadow)]" initial={{ rotate: -2, y: 10, opacity: 0 }} animate={{ rotate: -2, y: 0, opacity: 1 }} whileHover={{ rotate: 0, y: -4 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/lettering/coastline-prints-white.png" alt="" className="h-5 w-auto sm:h-6" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/lettering/gift-card-blue.png" alt="" className="mt-3 h-10 w-auto sm:h-12" />
        <div className="absolute inset-x-6 bottom-6 flex items-end justify-between gap-4">
          <div className="min-w-0 text-sm">
            <p className="truncate text-white/70">{to ? `For ${to}` : "For someone special"}</p>
            <p className="truncate text-white/70">{from ? `From ${from}` : ""}</p>
          </div>
          <AnimatedNumber value={amountCents >= GIFT_MIN_CENTS ? amountCents : 0} format={formatTotal} live={false} pulse className="font-display text-3xl font-bold text-sand sm:text-4xl" />
        </div>
      </motion.div>
      <AnimatePresence>
        {message.trim() && (
          <motion.blockquote initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6 border-l-4 border-accent-line pl-4 text-sm leading-relaxed text-muted">
            <span className="whitespace-pre-wrap">{message}</span>
          </motion.blockquote>
        )}
      </AnimatePresence>
      <p className="mt-6 text-sm leading-relaxed text-faint">The card arrives by email with its number and PIN. It works on any order and doesn&apos;t expire.</p>
    </div>
  );
}

function Chip({ active, onClick, delay = 0, children }: { active: boolean; onClick: () => void; delay?: number; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: active ? -2 : 0, scale: active ? [1, 1.1, 1] : 1 }}
      transition={{ opacity: { delay }, y: { type: "spring", stiffness: 400, damping: 20 }, scale: { duration: 0.3 } }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.92 }}
      className={cn("rounded-full border px-5 py-2.5 text-base font-semibold transition-colors", active ? "border-accent-line bg-accent text-accent-ink" : "border-line bg-surface text-fg hover:border-accent-line")}
    >
      {children}
    </motion.button>
  );
}

function inputClass(error?: string) {
  return cn(
    "h-11 w-full rounded-xl border bg-surface px-3.5 text-sm text-fg outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-accent-line focus:shadow-[0_0_0_4px_var(--accent-soft)]",
    error ? "border-danger/60" : "border-line",
  );
}

function Field({ id, label, error, className, children }: { id: string; label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted">
        {label}
      </label>
      {children}
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0, x: [0, -4, 4, -2, 0] }} exit={{ opacity: 0 }} className="mt-1.5 text-xs text-danger" role="alert">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
