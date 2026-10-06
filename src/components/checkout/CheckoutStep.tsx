"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { site } from "@config/site";
import { useConfig } from "@/components/ConfigProvider";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { PrintingLoader } from "@/components/motion/PrintingLoader";
import { modelSilhouette, type Silhouette } from "@/lib/order/silhouette";
import { OrderAnimation, type PayResult } from "./OrderAnimation";
import { bounce, Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { customerSchema } from "@/lib/checkout/schema";
import { cn } from "@/lib/cn";
import { hours, money } from "@/lib/format";
import { useOrder, type CartItem } from "@/lib/order/store";
import { cartPayload, type CartQuote } from "@/lib/order/use-quote";
import { PaymentMethods, type PaymentMethodsHandle, type SquareConfig } from "./PaymentMethods";
import { PickupPicker, type PickupChoice } from "./PickupPicker";
import { CodeBox } from "./CodeBox";
import { applyCodes, codeEntry, type CodeInfo } from "@/lib/codes/apply";

type Contact = {
  name: string;
  email: string;
  phone: string;
  notes: string;
  pickupAcknowledged: boolean;
  termsAccepted: boolean;
};
type FieldErrors = Partial<Record<keyof Contact, string>>;

const formatTotal = (v: number) => money(Math.round(v));
/** Tells the server the send-off is over, so the receipt, owner email and ticket go out now. */
const releaseSendOff = (viewToken: string) =>
  fetch("/api/sendoff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: viewToken }), keepalive: true }).catch(() => undefined);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function CheckoutStep({ items, cartQuote, square, onBack }: { items: CartItem[]; cartQuote: CartQuote; square: SquareConfig | null; onBack: () => void }) {
  const cfg = useConfig();
  const router = useRouter();
  const resetCart = useOrder((s) => s.reset);
  const payRef = useRef<PaymentMethodsHandle>(null);
  const [contact, setContact] = useState<Contact>({
    name: "",
    email: "",
    phone: "",
    notes: "",
    pickupAcknowledged: false,
    termsAccepted: false,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pickup, setPickup] = useState<PickupChoice>(null);
  const [pickupError, setPickupError] = useState<string>();
  const [busy, setBusy] = useState<false | "verifying" | "charging" | "processing">(false);
  const [payError, setPayError] = useState<{
    message: string;
    n: number;
  } | null>(null);

  const quote = cartQuote.quote;
  const [codes, setCodes] = useState<CodeInfo[]>([]);
  const orderTotal = quote?.ok ? quote.totalCents : 0;
  const discount = applyCodes(orderTotal, codes);
  const total = discount.totalCents;
  const covered = !!quote?.ok && total === 0;
  const canPay = (!!square || covered) && !!quote?.ok && cartQuote.confirmed && !busy;

  // The pay button hops once when everything is ready.
  const payButton = useRef<HTMLButtonElement>(null);
  const wasPayable = useRef(canPay);
  useEffect(() => {
    if (canPay && !wasPayable.current) bounce(payButton.current);
    wasPayable.current = canPay;
  }, [canPay]);

  const set = <K extends keyof Contact>(k: K, v: Contact[K]) => {
    setContact((c) => ({ ...c, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  function validate() {
    const r = customerSchema.safeParse(contact);
    const pickupOk = !!pickup?.date && !!pickup.time;
    setPickupError(pickupOk ? undefined : "Please choose a pickup day and time.");
    if (r.success && pickupOk) {
      setErrors({});
      return r.data;
    }
    if (r.success) {
      document.getElementById("co-pickup")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return null;
    }
    const next: FieldErrors = {};
    for (const issue of r.error.issues) {
      const k = issue.path[0] as keyof Contact;
      next[k] ??= issue.message;
    }
    setErrors(next);
    document.getElementById(`co-${Object.keys(next)[0]}`)?.focus();
    return null;
  }

  // The full-screen send-off that plays while the payment goes through.
  const [sendOff, setSendOff] = useState<{ result: PayResult; fileName: string; model: Silhouette | null; color: string } | null>(null);
  const sending = useRef(false);
  const paidToken = useRef<string | null>(null);

  function startSendOff() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !items.length) return;
    const first = items[0];
    const color = cfg.materials.find((m) => m.id === first.material)?.colors.find((c) => c.id === first.colorId)?.hex ?? "#3d7bb8";
    sending.current = true;
    setSendOff({ result: "pending", fileName: first.fileName, model: first.positions ? modelSilhouette(first.positions, color) : null, color });
  }

  function sendOffDone() {
    // The Benchy has sailed: send the receipt and owner email, show the confirmation,
    // then empty the cart once it's showing so checkout doesn't flash back to the upload step.
    void releaseSendOff(paidToken.current!);
    router.push(`/orders/${paidToken.current}`);
    window.setTimeout(resetCart, 2000);
  }

  function fail(message: string) {
    sending.current = false;
    setSendOff(null);
    setBusy(false);
    setPayError((p) => ({ message, n: (p?.n ?? 0) + 1 }));
  }

  async function payWithCard() {
    setPayError(null);
    const customer = validate();
    if (!customer) return;
    // Gift cards cover everything: no card needed.
    if (covered) return submit("", customer);
    if (!payRef.current) return;
    setBusy("verifying");
    const [givenName, ...rest] = customer.name.split(/\s+/);
    let token: string;
    try {
      token = await payRef.current.tokenizeCard({
        amount: (total / 100).toFixed(2),
        currencyCode: "CAD",
        intent: "CHARGE",
        billingContact: {
          givenName,
          familyName: rest.join(" ") || undefined,
          email: customer.email,
          phone: customer.phone,
          countryCode: "CA",
        },
        customerInitiated: true,
        sellerKeyedIn: false,
      });
    } catch (err) {
      return fail(err instanceof Error ? err.message : "Please check your card details.");
    }
    await submit(token, customer);
  }

  async function payWithWallet(token: string) {
    setPayError(null);
    const customer = validate();
    if (!customer) return fail("Please fill in your contact details first, then try again.");
    await submit(token, customer);
  }

  async function submit(sourceId: string, customer: ReturnType<typeof customerSchema.parse>) {
    setBusy("charging");
    startSendOff();
    const attemptId = crypto.randomUUID();
    const body = JSON.stringify({
      attemptId,
      sourceId,
      customer,
      pickup,
      items: cartPayload(items),
      expectedTotalCents: total,
      codes: codes.map(codeEntry),
    });

    // One automatic retry on a lost connection. The same attempt id means Square won't charge twice.
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
      } catch {
        if (attempt === 0) {
          await sleep(1500);
          continue;
        }
        return fail("We lost the connection while paying. Check your email for a receipt before trying again.");
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === "paid") return done(data.viewToken);
      if (res.status === 202) return pollUntilDone(attemptId);
      if (res.status === 503 && data.retryable && attempt === 0) {
        await sleep(1500);
        continue;
      }
      if (data.code === "PICKUP_UNAVAILABLE") {
        setPickup(null);
        return fail("That pickup time just became unavailable. Please choose another one and pay again.");
      }
      if (data.code === "CODE_INVALID") {
        if (data.badCode) setCodes((cs) => cs.filter((c) => c.code !== data.badCode));
        return fail(`${data.error ?? "One of your codes can't be used."} Your card was not charged.`);
      }
      if (data.code === "PRICE_CHANGED") return fail(`The price changed to ${money(data.totalCents)}. Please review it and pay again.`);
      return fail(data.error ?? "The payment didn't go through. Your card was not charged.");
    }
  }

  async function pollUntilDone(attemptId: string) {
    setBusy("processing");
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      const res = await fetch(`/api/checkout/${attemptId}`).catch(() => null);
      const data = res?.ok ? await res.json() : null;
      if (data?.status === "paid") return done(data.viewToken);
      if (data?.status === "failed") return fail("The payment didn't go through. Your card was not charged.");
    }
    fail("Your payment is still processing. You'll get an email receipt as soon as it completes.");
  }

  function done(viewToken: string) {
    if (sending.current) {
      // Let the send-off finish; it opens the confirmation when the Benchy is gone.
      paidToken.current = viewToken;
      setSendOff((s) => s && { ...s, result: "paid" });
      return;
    }
    // No animation (reduced motion): send everything straight away.
    void releaseSendOff(viewToken);
    resetCart();
    router.push(`/orders/${viewToken}`);
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-10">
      {sendOff && <OrderAnimation result={sendOff.result} fileName={sendOff.fileName} model={sendOff.model} color={sendOff.color} onDone={sendOffDone} />}
      <div className="min-w-0 space-y-6">
        <Card flat className="p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">Your details</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">We use these to send your receipt and tell you when your order is ready.</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field id="co-name" label="Full name" error={errors.name} valid={contact.name.trim().length >= 2} className="sm:col-span-2">
              <input
                id="co-name"
                autoComplete="name"
                value={contact.name}
                onChange={(e) => set("name", e.target.value)}
                className={inputClass(errors.name)}
                aria-invalid={!!errors.name}
                aria-describedby="co-name-err"
              />
            </Field>
            <Field id="co-email" label="Email" error={errors.email} valid={/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email.trim())}>
              <input
                id="co-email"
                type="email"
                autoComplete="email"
                value={contact.email}
                onChange={(e) => set("email", e.target.value)}
                className={inputClass(errors.email)}
                aria-invalid={!!errors.email}
                aria-describedby="co-email-err"
              />
            </Field>
            <Field id="co-phone" label="Phone" error={errors.phone} valid={contact.phone.replace(/\D/g, "").length >= 10}>
              <input
                id="co-phone"
                type="tel"
                autoComplete="tel"
                placeholder="604 555 0123"
                value={contact.phone}
                onChange={(e) => set("phone", e.target.value)}
                className={inputClass(errors.phone)}
                aria-invalid={!!errors.phone}
                aria-describedby="co-phone-err"
              />
            </Field>
            <Field id="co-notes" label="Notes (optional)" className="sm:col-span-2">
              <textarea
                id="co-notes"
                rows={3}
                maxLength={1000}
                placeholder="Anything we should know about your print?"
                value={contact.notes}
                onChange={(e) => set("notes", e.target.value)}
                className={cn(inputClass(), "h-auto py-2.5")}
              />
            </Field>
          </div>

          <div className="mt-6 space-y-4">
            <Check id="co-pickupAcknowledged" checked={contact.pickupAcknowledged} onChange={(v) => set("pickupAcknowledged", v)} error={errors.pickupAcknowledged}>
              I understand this order is <strong className="text-fg">local pickup only</strong>. The pickup address is shown after payment and in my receipt email.
            </Check>
            <Check id="co-termsAccepted" checked={contact.termsAccepted} onChange={(v) => set("termsAccepted", v)} error={errors.termsAccepted}>
              I agree to the{" "}
              <Link href="/terms" target="_blank" className="text-accent-text underline underline-offset-4">
                Terms &amp; Conditions
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" className="text-accent-text underline underline-offset-4">
                Privacy Policy
              </Link>
              .
            </Check>
          </div>
        </Card>

        <Card flat id="co-pickup" className="p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">Pickup time</h2>
          <div className="mt-3">
            <PickupPicker
              value={pickup}
              onChange={(v) => {
                setPickup(v);
                if (v?.time) setPickupError(undefined);
              }}
              error={pickupError}
            />
          </div>
        </Card>

        <Card flat className="relative overflow-hidden p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">Payment</h2>
          <div className="mt-5">
            {covered ? (
              <p className="rounded-xl bg-success/15 p-3 text-sm text-success">Your gift card covers this whole order. No card needed.</p>
            ) : square ? (
              <PaymentMethods ref={payRef} config={square} totalCents={total} disabled={!canPay} onWalletToken={payWithWallet} onWalletError={fail} />
            ) : (
              <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
                Online payments aren&apos;t set up yet. Add the Square keys to <code className="font-mono">.env</code> to enable checkout.
              </p>
            )}
          </div>

          <AnimatePresence>
            {payError && (
              <motion.div
                key={payError.n}
                role="alert"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0, x: [0, -10, 10, -6, 6, 0] }}
                exit={{ opacity: 0 }}
                transition={{ x: { duration: 0.45 } }}
                className="mt-4 flex gap-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
              >
                <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-danger font-bold text-white">
                  !
                </span>
                <span>{payError.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <Button ref={payButton} size="lg" className="mt-6 w-full" disabled={!canPay} onClick={payWithCard}>
            {covered ? "Place order" : `Pay ${quote?.ok ? money(total) : ""}`}
          </Button>
          {!cartQuote.confirmed && <p className="mt-2 text-center text-xs text-faint">Confirming your price…</p>}

          <AnimatePresence>
            {busy && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 grid place-items-center bg-bg/85 backdrop-blur-sm"
                aria-live="assertive"
              >
                <PrintingLoader label={busy === "verifying" ? "Checking your card…" : busy === "processing" ? "Waiting for the bank…" : "Processing payment…"} />
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>

      <div className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:self-start">
        <Card flat highlight className="p-6 sm:p-8">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold">Order summary</h2>
            <button type="button" onClick={onBack} className="text-sm text-accent-text underline underline-offset-4" disabled={!!busy}>
              Edit
            </button>
          </div>
          <ul className="mt-5 space-y-4 text-sm">
            {items.map((item, i) => {
              const q = quote?.items[i];
              const color = cfg.materials.find((m) => m.id === item.material)?.colors.find((c) => c.id === item.colorId);
              return (
                <motion.li key={item.key} className="flex gap-3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                  <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-line-strong" style={{ background: color?.hex }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {item.fileName} <span className="text-faint">× {item.quantity}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {item.material} · {color?.name}
                      {q?.ok && (
                        <>
                          {" "}
                          · {q.assignment.orientedSize.x.toFixed(0)}×{q.assignment.orientedSize.y.toFixed(0)}×{q.assignment.orientedSize.z.toFixed(0)} mm · about{" "}
                          {hours(q.hoursTotal)}
                        </>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono tabular-nums">{q?.ok ? money(q.lineCents) : "…"}</span>
                </motion.li>
              );
            })}
          </ul>
          <dl className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Order fee</dt>
              <dd className="font-mono">{quote ? money(quote.baseFeeCents) : "…"}</dd>
            </div>
            {quote && quote.minimumAdjCents > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">Minimum order top-up</dt>
                <dd className="font-mono">{money(quote.minimumAdjCents)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted">{site.fulfillmentLabel}</dt>
              <dd className="font-mono">Free</dd>
            </div>
            <AnimatePresence initial={false}>
              {discount.applied.map((a) => (
                <motion.div
                  key={a.code}
                  className="flex justify-between overflow-hidden text-success"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <dt>{a.label}</dt>
                  <dd className="font-mono">−{money(a.amountCents)}</dd>
                </motion.div>
              ))}
            </AnimatePresence>
          </dl>
          <CodeBox orderTotalCents={orderTotal} codes={codes} result={discount} onChange={setCodes} disabled={!!busy || !quote?.ok} />
          <div className="mt-4 flex items-end justify-between border-t-2 border-line-strong pt-4">
            <span className="text-sm text-muted">Total (CAD)</span>
            <AnimatedNumber value={total} format={formatTotal} className="font-display text-3xl font-bold tabular-nums" pulse />
          </div>
        </Card>
      </div>
    </div>
  );
}

function inputClass(error?: string) {
  return cn(
    "h-11 w-full rounded-xl border bg-surface px-3.5 pr-10 text-sm text-fg outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-accent-line focus:shadow-[0_0_0_4px_var(--accent-soft)]",
    error ? "border-danger/60" : "border-line",
  );
}

function Field({ id, label, error, valid, className, children }: { id: string; label: string; error?: string; valid?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted">
        {label}
      </label>
      <div className="relative">
        {children}
        {/* A small tick pops in once the field looks right */}
        <AnimatePresence>
          {valid && !error && (
            <motion.span
              className="pointer-events-none absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-success/15 text-success"
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
              aria-hidden
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <motion.path d="M5 13l4 4L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.1, duration: 0.25 }} />
              </svg>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            id={`${id}-err`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0, x: [0, -4, 4, -2, 0] }}
            exit={{ opacity: 0 }}
            className="mt-1.5 text-xs text-danger"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function Check({ id, checked, onChange, error, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm text-muted">
        <span className="relative mt-0.5 grid h-5 w-5 shrink-0 place-items-center">
          <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            aria-invalid={!!error}
            className={cn(
              "peer h-5 w-5 appearance-none rounded-md border-2 transition-[background-color,border-color,transform] duration-150 checked:border-accent-line checked:bg-accent active:scale-90",
              error ? "border-danger" : "border-line-strong",
            )}
          />
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute"
            aria-hidden
          >
            <motion.path
              d="M5 13l4 4L19 7"
              initial={false}
              animate={{
                pathLength: checked ? 1 : 0,
                opacity: checked ? 1 : 0,
              }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            />
          </svg>
        </span>
        <span>{children}</span>
      </label>
      {error && <p className="mt-1 pl-8 text-xs text-danger">{error}</p>}
    </div>
  );
}
