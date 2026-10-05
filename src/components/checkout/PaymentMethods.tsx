"use client";
import { AnimatePresence, motion } from "framer-motion";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { site } from "@config/site";
import { loadSquareSdk } from "@/lib/square/load-sdk";

export type SquareConfig = { applicationId: string; locationId: string; environment: "sandbox" | "production"; scriptUrl: string };

export type PaymentMethodsHandle = {
  /** Tokenizes the card form. Returns a Square source id, or throws a customer-readable error. */
  tokenizeCard(details: SquareWeb.VerificationDetails): Promise<string>;
};

type Props = {
  config: SquareConfig;
  totalCents: number;
  disabled: boolean;
  /** Called when a wallet (Google Pay / Apple Pay) produced a token. */
  onWalletToken: (token: string) => void;
  onWalletError: (message: string) => void;
};

const amount = (cents: number) => (cents / 100).toFixed(2);

/** Square card form plus Google Pay / Apple Pay when the device supports them. */
export const PaymentMethods = forwardRef<PaymentMethodsHandle, Props>(function PaymentMethods({ config, totalCents, disabled, onWalletToken, onWalletError }, ref) {
  const card = useRef<SquareWeb.PaymentMethod | null>(null);
  const request = useRef<SquareWeb.PaymentRequest | null>(null);
  const google = useRef<SquareWeb.PaymentMethod | null>(null);
  const apple = useRef<SquareWeb.PaymentMethod | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [wallets, setWallets] = useState({ google: false, apple: false });
  const totalRef = useRef(totalCents);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadSquareSdk(config.scriptUrl);
        if (!window.Square) throw new Error("The payment form didn't load.");
        const payments = await window.Square.payments(config.applicationId, config.locationId);
        const styles = getComputedStyle(document.documentElement);
        const c = await payments.card({
          style: {
            input: { color: styles.getPropertyValue("--text").trim() || "#eef3f8", backgroundColor: "transparent", fontSize: "15px" },
            "input::placeholder": { color: styles.getPropertyValue("--faint").trim() || "#71859a" },
            ".input-container": { borderColor: styles.getPropertyValue("--border-strong").trim() || "#2d4a65", borderRadius: "12px" },
            ".input-container.is-focus": { borderColor: styles.getPropertyValue("--accent-line").trim() || "#3d7bb8" },
            ".input-container.is-error": { borderColor: styles.getPropertyValue("--danger").trim() || "#ff5c6c" },
            ".message-text": { color: styles.getPropertyValue("--muted").trim() || "#a5b6c7" },
            ".message-icon": { color: styles.getPropertyValue("--muted").trim() || "#a5b6c7" },
          },
        });
        if (cancelled) return void c.destroy();
        await c.attach("#sq-card");
        card.current = c;

        const req = payments.paymentRequest({ countryCode: "CA", currencyCode: "CAD", total: { amount: amount(totalRef.current), label: site.name } });
        request.current = req;
        try {
          const g = await payments.googlePay(req);
          await g.attach("#sq-gpay", { buttonColor: "black", buttonSizeMode: "fill", buttonType: "long" });
          google.current = g;
          if (!cancelled) setWallets((w) => ({ ...w, google: true }));
        } catch {
          // Google Pay not available on this device/browser.
        }
        try {
          apple.current = await payments.applePay(req);
          if (!cancelled) setWallets((w) => ({ ...w, apple: true }));
        } catch {
          // Apple Pay needs Safari + a verified domain; hidden otherwise.
        }
        if (!cancelled) setState("ready");
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "The payment form didn't load.");
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
      card.current?.destroy();
      google.current?.destroy();
      card.current = google.current = apple.current = null;
    };
  }, [config]);

  // Keep wallet sheets in sync with the order total.
  useEffect(() => {
    totalRef.current = totalCents;
    request.current?.update({ total: { amount: amount(totalCents), label: site.name } });
  }, [totalCents]);

  useImperativeHandle(ref, () => ({
    async tokenizeCard(details) {
      if (!card.current) throw new Error("The payment form isn't ready yet.");
      const result = await card.current.tokenize(details);
      if (result.status === "OK" && result.token) return result.token;
      throw new Error(result.errors?.[0]?.message ?? "Please check your card details.");
    },
  }));

  async function payWithWallet(method: SquareWeb.PaymentMethod | null) {
    if (!method || disabled) return;
    try {
      const result = await method.tokenize();
      if (result.status === "OK" && result.token) onWalletToken(result.token);
      else if (result.status !== "Cancel") onWalletError(result.errors?.[0]?.message ?? "The wallet payment didn't go through.");
    } catch {
      onWalletError("The wallet payment didn't go through. Please try your card instead.");
    }
  }

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {(wallets.google || wallets.apple) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-3">
            {wallets.apple && (
              <button
                type="button"
                onClick={() => payWithWallet(apple.current)}
                disabled={disabled}
                aria-label="Pay with Apple Pay"
                className="h-12 w-full rounded-full disabled:opacity-50 [-webkit-appearance:-apple-pay-button] [-apple-pay-button-style:black] [-apple-pay-button-type:buy]"
              />
            )}
            <div className="flex items-center gap-3 text-xs text-faint">
              <span className="h-px flex-1 bg-line" /> or pay by card <span className="h-px flex-1 bg-line" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Google Pay renders its own button into this element. */}
      <div
        id="sq-gpay"
        onClick={() => payWithWallet(google.current)}
        className={wallets.google ? "h-12 overflow-hidden rounded-full" : "hidden"}
        aria-hidden={!wallets.google}
      />

      <div className="relative min-h-[90px]">
        <div id="sq-card" aria-label="Card details" />
        {state === "loading" && (
          <div className="absolute inset-0 space-y-2">
            <div className="skeleton h-12 w-full" />
            <p className="text-xs text-faint">Loading secure card form…</p>
          </div>
        )}
        {state === "error" && (
          <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            {loadError}
          </p>
        )}
      </div>
      <p className="flex items-center gap-2 text-xs text-faint">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        Card details go straight to Square. We never see your full card number.
        {config.environment === "sandbox" && <span className="ml-auto rounded-full bg-sand/20 px-2 py-0.5 font-medium text-sand">Test mode</span>}
      </p>
    </div>
  );
});
