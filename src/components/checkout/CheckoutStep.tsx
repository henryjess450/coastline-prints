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
import { addressSchema, customerSchema } from "@/lib/checkout/schema";
import { cn } from "@/lib/cn";
import { hours, money } from "@/lib/format";
import { useOrder, type CartItem } from "@/lib/order/store";
import { itemColors } from "@/lib/order/derive";
import { cartPayload, type CartQuote } from "@/lib/order/use-quote";
import { PaymentMethods, type PaymentMethodsHandle, type SquareConfig } from "./PaymentMethods";
import { PickupPicker, type PickupChoice } from "./PickupPicker";
import { CodeBox } from "./CodeBox";
import { INVITE_KEY } from "@/components/account/SaveInvite";
import { Field, inputClass } from "./fields";
import { AddressForm, BoxSummary, emptyAddress, MethodToggle, ShipOptions, type AddressDraft, type AddressErrors, type DeliveryMethod } from "./Delivery";
import { withParcel, type ShippingMethod, type ShippingOption } from "@/lib/shipping/pack";
import { useAccount } from "@/components/account/use-account";
import { applyCodes, codeEntry, type CodeInfo } from "@/lib/codes/apply";
import { etransferDiscount, type EtransferPublic } from "@/lib/payments/etransfer";
import { EtransferWaiting, type EtransferDetails } from "./EtransferWaiting";

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

export function CheckoutStep({ items, cartQuote, square, etransfer, onBack }: { items: CartItem[]; cartQuote: CartQuote; square: SquareConfig | null; etransfer: EtransferPublic; onBack: () => void }) {
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

  // Signed in: fill in their saved details (only boxes they haven't typed in), and glow them briefly.
  const [flash, setFlash] = useState<Set<keyof Contact>>(new Set());
  const typed = useRef(contact);
  useEffect(() => {
    typed.current = contact;
  });
  const [address, setAddress] = useState<AddressDraft>(emptyAddress);
  const typedAddress = useRef<AddressDraft>(emptyAddress);
  const [addressFlash, setAddressFlash] = useState(false);
  const account = useAccount((a) => {
    if (!a.signedIn) return;
    // Their saved shipping address, if they haven't started typing one.
    if (a.address && Object.values(typedAddress.current).every((v) => !v.trim())) {
      setAddress({ ...emptyAddress, ...a.address, line2: a.address.line2 ?? "" });
      setAddressFlash(true);
      setTimeout(() => setAddressFlash(false), 1600);
    }
    const fill = (["name", "email", "phone"] as const).filter((k) => !typed.current[k].trim() && a[k]);
    if (!fill.length) return;
    setContact((c) => ({ ...c, ...Object.fromEntries(fill.filter((k) => !c[k].trim()).map((k) => [k, a[k]])) }));
    setFlash(new Set(fill));
    setTimeout(() => setFlash(new Set()), 1600);
  });
  const [pickup, setPickup] = useState<PickupChoice>(null);
  const [pickupError, setPickupError] = useState<string>();
  const [method, setMethod] = useState<DeliveryMethod>("pickup");
  const [addressErrors, setAddressErrors] = useState<AddressErrors>({});
  useEffect(() => {
    typedAddress.current = address;
  });
  /** null = the default (cheapest) option. */
  const [shipChoice, setShipChoice] = useState<ShippingMethod | null>(null);
  const [busy, setBusy] = useState<false | "verifying" | "charging" | "processing">(false);
  const [payError, setPayError] = useState<{
    message: string;
    n: number;
  } | null>(null);

  const quote = cartQuote.quote;
  const [codes, setCodes] = useState<CodeInfo[]>([]);
  const orderTotal = quote?.ok ? quote.totalCents : 0;
  const shippingQuote = quote?.ok ? quote.shipping : null;
  // The cart changed and can't ship any more: fall back to pickup.
  const ships = method === "ship" && !!shippingQuote?.ok;
  // The tracked-mailer price depends on the destination, so it's fetched once the postal code is in.
  const parcel = shippingQuote?.ok ? shippingQuote.parcel : null;
  const postalKey = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(address.postal.trim()) ? address.postal.toUpperCase().replace(/\s/g, "") : "";
  const rateKey = method === "ship" && parcel && postalKey && cartQuote.ready ? `${JSON.stringify(cartPayload(items))}|${postalKey}` : "";
  const [parcelRate, setParcelRate] = useState<{ key: string; option: ShippingOption | null } | null>(null);
  useEffect(() => {
    if (!rateKey) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const [cart, postal] = rateKey.split("|");
      const res = await fetch("/api/shipping/rates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: JSON.parse(cart), postal }), signal: ctrl.signal }).catch(() => null);
      const data = res?.ok ? await res.json().catch(() => null) : null;
      if (!ctrl.signal.aborted) setParcelRate({ key: rateKey, option: data?.option ?? null });
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [rateKey]);
  const parcelOption = parcelRate?.key === rateKey && rateKey ? parcelRate.option : null;
  const parcelHint = !parcel ? null : !postalKey ? "postal" : parcelRate?.key !== rateKey ? "loading" : null;
  const shipOptions = shippingQuote?.ok ? withParcel(shippingQuote.options, parcelOption) : [];
  // If the cart changes and the chosen option goes away (no longer fits a mailer), use the default.
  const shipOption = shipOptions.find((o) => o.method === shipChoice) ?? shipOptions[0] ?? null;
  const shippingCents = ships && shipOption ? shipOption.totalCents : 0;
  const discount = applyCodes(orderTotal, codes, shippingCents);
  // e-Transfer is the preferred way to pay (no card fees), with a small discount for it.
  const [payBy, setPayBy] = useState<"etransfer" | "card">(etransfer ? "etransfer" : "card");
  const byEtransfer = payBy === "etransfer" && !!etransfer;
  const covered = !!quote?.ok && discount.totalCents === 0;
  const etransferOff = byEtransfer && !covered ? etransferDiscount(discount.totalCents, etransfer.discountPercent) : 0;
  const total = discount.totalCents - etransferOff;
  const [waiting, setWaiting] = useState<EtransferDetails | null>(null);
  const canPay = (covered || (byEtransfer ? true : !!square)) && !!quote?.ok && cartQuote.confirmed && !busy && (method === "pickup" || ships);

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

  const setAddr = (k: keyof AddressDraft, v: string) => {
    setAddress((a) => ({ ...a, [k]: v }));
    if (addressErrors[k]) setAddressErrors((e) => ({ ...e, [k]: undefined }));
  };

  function chooseMethod(m: DeliveryMethod) {
    setMethod(m);
    // Most people ship to themselves.
    if (m === "ship" && !address.name.trim() && contact.name.trim()) setAddress((a) => ({ ...a, name: contact.name.trim() }));
  }

  /** The customer and where the order goes, or null after showing what's missing. */
  function validate() {
    const r = customerSchema.safeParse(contact);
    const next: FieldErrors = {};
    if (!r.success) {
      for (const issue of r.error.issues) {
        const k = issue.path[0] as keyof Contact;
        next[k] ??= issue.message;
      }
    }
    if (method === "pickup" && !contact.pickupAcknowledged) next.pickupAcknowledged = "Please confirm you'll pick up your order.";
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(`co-${Object.keys(next)[0]}`)?.focus();
      return null;
    }
    const customer = r.data!;

    if (method === "pickup") {
      const pickupOk = !!pickup?.date && !!pickup.time;
      setPickupError(pickupOk ? undefined : "Please choose a pickup day and time.");
      if (!pickupOk) {
        document.getElementById("co-pickup")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return null;
      }
      return { customer, fulfillment: { method: "pickup" as const, date: pickup!.date, time: pickup!.time } };
    }

    const a = addressSchema.safeParse(address);
    if (!a.success) {
      const errs: AddressErrors = {};
      for (const issue of a.error.issues) errs[issue.path[0] as keyof AddressDraft] ??= issue.message;
      setAddressErrors(errs);
      document.getElementById(`ship-${Object.keys(errs)[0]}`)?.focus();
      return null;
    }
    setAddressErrors({});
    setAddress((d) => ({ ...d, postal: a.data.postal }));
    return { customer, fulfillment: { method: "ship" as const, option: shipOption!.method, address: a.data } };
  }
  type Checked = NonNullable<ReturnType<typeof validate>>;

  // The full-screen send-off that plays while the payment goes through.
  const [sendOff, setSendOff] = useState<{ result: PayResult; fileName: string; model: Silhouette | null; color: string } | null>(null);
  const sending = useRef(false);
  const paidToken = useRef<string | null>(null);

  function startSendOff() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !items.length) return;
    const first = items[0];
    const color = itemColors(first, cfg).hexes[0] ?? "#3d7bb8";
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
    const checked = validate();
    if (!checked) return;
    const { customer } = checked;
    // Gift cards cover everything, or paying by e-Transfer: no card needed.
    if (covered || byEtransfer) return submit("", checked);
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
    await submit(token, checked);
  }

  async function payWithWallet(token: string) {
    setPayError(null);
    const checked = validate();
    if (!checked) return fail(method === "ship" ? "Please fill in your contact details and shipping address first, then try again." : "Please fill in your contact details first, then try again.");
    await submit(token, checked);
  }

  async function submit(sourceId: string, { customer, fulfillment }: Checked) {
    const payment = byEtransfer && !covered ? "etransfer" : "card";
    setBusy("charging");
    // e-Transfer orders get their send-off once the money lands.
    if (payment === "card") startSendOff();
    const attemptId = crypto.randomUUID();
    const body = JSON.stringify({
      attemptId,
      payment,
      sourceId,
      customer,
      fulfillment,
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
      if (res.ok && data.status === "awaiting_etransfer") {
        setBusy(false);
        setWaiting({ attemptId: data.attemptId, code: data.code, amountCents: data.amountCents, sendTo: data.sendTo, expiresAt: data.expiresAt });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
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
        try {
          if (data.badCode && localStorage.getItem(INVITE_KEY) === data.badCode) localStorage.removeItem(INVITE_KEY);
        } catch {}
        return fail(`${data.error ?? "One of your codes can't be used."} Your card was not charged.`);
      }
      if (data.code === "SHIPPING_CHANGED") {
        setShipChoice(null);
        return fail(`${data.error} Your card was not charged.`);
      }
      if (data.code === "SHIPPING_UNAVAILABLE") {
        setMethod("pickup");
        return fail(`${data.error ?? "Shipping isn't available for this order."} Your card was not charged.`);
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
    // A friend's invite code is spent on this first order.
    try {
      localStorage.removeItem(INVITE_KEY);
    } catch {}
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

  if (waiting) {
    return (
      <div>
        {sendOff && <OrderAnimation result={sendOff.result} fileName={sendOff.fileName} model={sendOff.model} color={sendOff.color} onDone={sendOffDone} />}
        <EtransferWaiting
          details={waiting}
          onPaid={(viewToken) => {
            // The money's in: now the Benchy sails, then the confirmation.
            startSendOff();
            done(viewToken);
          }}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-10">
      {sendOff && <OrderAnimation result={sendOff.result} fileName={sendOff.fileName} model={sendOff.model} color={sendOff.color} onDone={sendOffDone} />}
      <div className="min-w-0 space-y-6">
        <Card flat className="p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">Your details</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">We use these to send your receipt and tell you when your order is ready.</p>
          <AccountNote account={account} />
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field id="co-name" label="Full name" error={errors.name} valid={contact.name.trim().length >= 2} className="sm:col-span-2">
              <input
                id="co-name"
                autoComplete="name"
                value={contact.name}
                onChange={(e) => set("name", e.target.value)}
                className={inputClass(errors.name, flash.has("name"))}
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
                className={inputClass(errors.email, flash.has("email"))}
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
                className={inputClass(errors.phone, flash.has("phone"))}
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
            {method === "pickup" && (
              <Check id="co-pickupAcknowledged" checked={contact.pickupAcknowledged} onChange={(v) => set("pickupAcknowledged", v)} error={errors.pickupAcknowledged}>
                I&apos;ll <strong className="text-fg">pick up this order</strong>. The pickup address is shown after payment and in my receipt email.
              </Check>
            )}
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
          <h2 className="font-display text-xl font-bold">Pickup or shipping</h2>
          <div className="mt-4">
            <MethodToggle value={ships ? "ship" : "pickup"} onChange={chooseMethod} shipping={shippingQuote} />
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={ships ? "ship" : "pickup"}
              className="mt-6"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {ships && shipOption ? (
                <div className="space-y-5">
                  <ShipOptions options={shipOptions} value={shipOption.method} onChange={setShipChoice} parcelHint={parcelHint} />
                  <BoxSummary option={shipOption} />
                  {account?.signedIn && account.address && <p className="-mb-2 text-sm text-muted">Filled in from your account. Change it here for this order, or in <Link href="/account/settings" target="_blank" className="text-accent-text underline underline-offset-4">settings</Link>.</p>}
                  <AddressForm value={address} onChange={setAddr} errors={addressErrors} flash={addressFlash} />
                  <p className="text-xs text-faint">Prints take about 2 to 5 days, then Canada Post takes a few business days depending on where you are. {shipOption.tracked ? "We email you the tracking number when it ships." : "We email you when it ships."}</p>
                </div>
              ) : (
                <PickupPicker
                  value={pickup}
                  onChange={(v) => {
                    setPickup(v);
                    if (v?.time) setPickupError(undefined);
                  }}
                  error={pickupError}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </Card>

        <Card flat className="relative overflow-hidden p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">Payment</h2>
          <div className="mt-5">
            {!covered && etransfer && <PayByToggle value={payBy} onChange={setPayBy} discountPercent={etransfer.discountPercent} />}
            {covered ? (
              <p className="rounded-xl bg-success/15 p-3 text-sm text-success">Your gift card covers this whole order. No card needed.</p>
            ) : byEtransfer ? (
              <p className="mt-4 rounded-2xl bg-accent-soft p-4 text-sm leading-relaxed">
                After you place the order, we&apos;ll show you where to send the e-Transfer and a code to put in the message. It&apos;s confirmed automatically when it lands. You have{" "}
                {etransfer.payWindowMinutes >= 60 ? `${etransfer.payWindowMinutes / 60} hour${etransfer.payWindowMinutes === 60 ? "" : "s"}` : `${etransfer.payWindowMinutes} minutes`} to send it.
              </p>
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
            {covered ? "Place order" : byEtransfer ? `Place order, pay ${quote?.ok ? money(total) : ""} by e-Transfer` : `Pay ${quote?.ok ? money(total) : ""}`}
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
              const color = itemColors(item, cfg);
              return (
                <motion.li key={item.key} className="flex gap-3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                  <span className="mt-0.5 flex shrink-0 -space-x-1.5" aria-hidden>
                    {color.hexes.map((hex, k) => (
                      <span key={k} className="h-4 w-4 rounded-full border border-line-strong" style={{ background: hex }} />
                    ))}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {item.fileName} <span className="text-faint">× {item.quantity}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {item.material} · {color.name}
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
              <dt className="text-muted">{ships ? (shipOption?.method === "mailer" ? "Shipping (bubble mailer)" : shipOption?.method === "parcel" ? "Shipping (tracked mailer)" : "Shipping (tracked box)") : site.fulfillmentLabel}</dt>
              <dd className="font-mono">{ships ? money(shippingCents) : "Free"}</dd>
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
            <AnimatePresence initial={false}>
              {etransferOff > 0 && (
                <motion.div key="etr" className="flex justify-between overflow-hidden text-success" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <dt>e-Transfer discount ({etransfer?.discountPercent}%)</dt>
                  <dd className="font-mono">−{money(etransferOff)}</dd>
                </motion.div>
              )}
            </AnimatePresence>
          </dl>
          <CodeBox orderTotalCents={orderTotal} shippingCents={shippingCents} codes={codes} result={discount} onChange={setCodes} disabled={!!busy || !quote?.ok} />
          <div className="mt-4 flex items-end justify-between border-t-2 border-line-strong pt-4">
            <span className="text-sm text-muted">Total (CAD)</span>
            <AnimatedNumber value={total} format={formatTotal} className="font-display text-3xl font-bold tabular-nums" pulse />
          </div>
        </Card>
      </div>
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

/** "Filled in from your account" when signed in, or a nudge to sign in when not. */
function AccountNote({ account }: { account: ReturnType<typeof useAccount> }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {account?.signedIn ? (
        <motion.div
          key="in"
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className="mt-4 flex items-center gap-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm"
        >
          <motion.span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-accent-text" initial={{ rotate: -90, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 16, delay: 0.1 }} aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
            </svg>
            <motion.span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-success text-white" initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ delay: 0.4, duration: 0.35 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </motion.span>
          </motion.span>
          <p className="min-w-0 leading-snug">
            Signed in as <strong className="break-all">{account.email}</strong>. We filled in your details.{" "}
            <Link href="/account/settings" target="_blank" className="whitespace-nowrap text-accent-text underline underline-offset-4">
              Edit
            </Link>
          </p>
        </motion.div>
      ) : account ? (
        <motion.p key="out" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 text-sm text-muted">
          Have an account?{" "}
          <a href="/account" target="_blank" rel="noopener" className="text-accent-text underline underline-offset-4">
            Sign in
          </a>{" "}
          and come back to this tab to fill this in for you.
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

/** e-Transfer (preferred) or card. */
function PayByToggle({ value, onChange, discountPercent }: { value: "etransfer" | "card"; onChange: (v: "etransfer" | "card") => void; discountPercent: number }) {
  const options = [
    { id: "etransfer" as const, title: "Interac e-Transfer", detail: `Preferred · ${discountPercent}% off · no fees` },
    { id: "card" as const, title: "Card", detail: "Visa, Mastercard, Apple Pay, Google Pay" },
  ];
  return (
    <div role="radiogroup" aria-label="How to pay" className="grid gap-3 sm:grid-cols-2">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={cn("relative rounded-2xl border px-4 py-3 text-left transition-[border-color,transform] duration-150 active:scale-[0.97]", active ? "border-accent-line" : "border-line hover:border-accent-line")}
          >
            {active && <motion.span layoutId="pay-by-active" className="absolute -inset-px rounded-2xl border-2 border-accent-line bg-accent-soft" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
            <span className="relative block font-semibold">{o.title}</span>
            <span className={cn("relative block text-sm", o.id === "etransfer" ? "text-success" : "text-muted")}>{o.detail}</span>
          </button>
        );
      })}
    </div>
  );
}
