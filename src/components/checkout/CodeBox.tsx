"use client";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { bounce } from "@/components/ui/Button";
import { applyCodes, isCardNumber, MAX_CODES, normalizeCode, normalizePin, type ApplyResult, type CodeInfo } from "@/lib/codes/apply";
import { money } from "@/lib/format";
import type { WalletItem } from "@/lib/account/wallet";
import { INVITE_KEY } from "@/components/account/SaveInvite";

/**
 * "Coupons or Gift Cards? Add them here!" with applied codes as removable chips.
 * A rejected code shakes the input; an accepted one bounces Apply and the new
 * chip wobbles in. Signed-in customers also see their saved cards and coupons
 * and can tap one to use it (no PIN needed, it's already locked to them).
 */
export function CodeBox({
  orderTotalCents,
  shippingCents = 0,
  codes,
  result,
  onChange,
  disabled,
}: {
  orderTotalCents: number;
  shippingCents?: number;
  codes: CodeInfo[];
  result: ApplyResult;
  onChange: (codes: CodeInfo[]) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const [pin, setPin] = useState("");
  const card = isCardNumber(value);
  const [error, setErrorText] = useState<string>();
  const shake = useAnimationControls();
  const applyBtn = useRef<HTMLButtonElement>(null);
  const setError = (msg?: string) => {
    setErrorText(msg);
    // Replays on every rejection, even with the same message.
    if (msg) void shake.start({ x: [0, -8, 8, -5, 5, 0], transition: { duration: 0.4 } });
  };
  const [checking, setChecking] = useState(false);

  // Saved cards and coupons for signed-in customers. Re-checked when the tab
  // regains focus, in case they just signed in from another tab.
  const [wallet, setWallet] = useState<{ signedIn: boolean; items: WalletItem[] } | null>(null);
  useEffect(() => {
    const load = () => fetch("/api/account/wallet").then((r) => (r.ok ? r.json() : null)).then((w) => w && setWallet(w), () => undefined);
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, []);
  // Came from a friend's invite link: add their code once, by itself. If it
  // can't be used (their own code, or not a first order), say why and forget it.
  const invited = useRef(false);
  useEffect(() => {
    if (invited.current || disabled) return;
    invited.current = true;
    let code: string | null = null;
    try {
      code = localStorage.getItem(INVITE_KEY);
    } catch {}
    if (code && !codes.some((c) => c.code === code)) void add(code, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  const savedReady = (wallet?.items ?? []).filter((w) => w.usable && !codes.some((c) => c.code === w.code));

  async function add(saved?: string, fromInvite = false) {
    const code = saved ?? normalizeCode(value);
    if (!code) return;
    if (codes.some((c) => c.code === code)) return setError("That code is already added.");
    if (codes.length >= MAX_CODES) return setError(`You can add up to ${MAX_CODES} codes.`);
    const cardPin = card && !saved ? normalizePin(pin) : "";
    if (card && !saved && cardPin.length !== 7) return setError("Enter the gift card PIN (CP and 5 numbers).");
    setChecking(true);
    setError(undefined);
    try {
      const res = await fetch("/api/codes/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, pin: cardPin || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (fromInvite) forgetInvite();
        return setError(body.error ?? "That code isn't valid.");
      }
      const next = [...codes, { ...(body.code as CodeInfo), pin: cardPin || undefined }];
      const why = applyCodes(orderTotalCents, next, shippingCents).rejected.find((r) => r.code === code);
      if (why) return setError(why.reason);
      onChange(next);
      bounce(applyBtn.current);
      if (saved) return;
      setValue("");
      setPin("");
    } catch {
      setError("Couldn't check that code. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-dashed border-line-strong p-4">
      <label htmlFor="code-input" className="text-sm font-medium">
        Coupons or Gift Cards? Add them here!
      </label>
      {/* Saved to their account: they pop up here, tap one to use it */}
      <AnimatePresence initial={false}>
        {savedReady.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-2xl bg-accent-soft p-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-accent-text">
                <motion.span className="inline-block h-2 w-2 rounded-full bg-sand" animate={{ scale: [1, 1.6, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 1.4, repeat: Infinity }} aria-hidden />
                {savedReady.length === 1 ? "You have 1 saved to your account. Tap to use it." : `You have ${savedReady.length} saved to your account. Tap to use them.`}
              </p>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                <AnimatePresence>
                  {savedReady.map((w, i) => (
                    <motion.li
                      key={w.code}
                      layout
                      initial={{ opacity: 0, scale: 0.4, y: 10, rotate: -8 }}
                      animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.4, y: -12 }}
                      transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.15 + i * 0.08 }}
                    >
                      <motion.button
                        type="button"
                        whileHover={{ y: -3, rotate: -2 }}
                        whileTap={{ scale: 0.9 }}
                        disabled={disabled || checking}
                        onClick={() => void add(w.code)}
                        className={
                          w.kind === "GIFT_CARD"
                            ? "flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-left text-xs font-medium text-accent-ink shadow-[var(--shadow)]"
                            : "flex items-center gap-2 rounded-xl border border-accent-line bg-surface px-3 py-2 text-left text-xs font-medium text-fg"
                        }
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          {w.kind === "GIFT_CARD" ? (
                            <>
                              <rect x="3" y="8" width="18" height="13" rx="2" />
                              <path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1s6 1 6 1 6 2 6-1-4-3-6 1" />
                            </>
                          ) : (
                            <path d="M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3zM9 9l6 6" />
                          )}
                        </svg>
                        <span>
                          {w.title}
                          <span className="ml-1.5 font-mono opacity-60">···{w.code.slice(-4)}</span>
                        </span>
                        <span className="ml-1 rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Use</span>
                      </motion.button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {wallet && !wallet.signedIn && (
        <p className="mt-2 text-xs text-faint">
          Saved a card to your account?{" "}
          <a href="/account" target="_blank" rel="noopener" className="text-accent-text underline underline-offset-4">
            Sign in
          </a>{" "}
          and come back to this tab.
        </p>
      )}
      <motion.div className="mt-3 flex flex-wrap gap-2" animate={shake}>
        <input
          id="code-input"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(undefined);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
          placeholder="Coupon code or gift card number"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={40}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? "code-error" : undefined}
          className="h-10 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 font-mono text-sm uppercase outline-none focus:border-accent-line"
        />
        {card && (
          <input
            aria-label="Gift card PIN"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add();
              }
            }}
            placeholder="PIN: CP#####"
            autoComplete="off"
            maxLength={10}
            disabled={disabled}
            className="h-10 w-32 rounded-full border border-line bg-surface px-4 font-mono text-sm uppercase outline-none focus:border-accent-line"
          />
        )}
        <button ref={applyBtn} type="button" onClick={() => void add()} disabled={disabled || checking || !value.trim()} className="btn btn-secondary h-10 px-4 text-sm">
          {checking ? "Checking…" : "Apply"}
        </button>
      </motion.div>
      <AnimatePresence>
        {error && (
          <motion.p id="code-error" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 text-xs text-danger">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      {result.applied.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          <AnimatePresence initial={false}>
            {result.applied.map((a) => {
              const info = codes.find((c) => c.code === a.code);
              const left = info?.kind === "GIFT_CARD" && info.balanceCents != null ? info.balanceCents - a.amountCents : null;
              return (
                <motion.li
                  key={a.code}
                  layout
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1, rotate: [0, -6, 6, -3, 0] }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ rotate: { duration: 0.5, delay: 0.1 } }}
                  className="inline-flex items-center gap-2 rounded-full bg-success/15 py-1 pl-3 pr-1 text-xs font-medium text-success"
                >
                  <span>
                    {a.label} · −{money(a.amountCents)}
                    {left != null && left > 0 && <span className="opacity-75"> ({money(left)} left after)</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => onChange(codes.filter((c) => c.code !== a.code))}
                    disabled={disabled}
                    aria-label={`Remove ${a.label}`}
                    className="grid h-5 w-5 place-items-center rounded-full hover:bg-success/25"
                  >
                    ×
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function forgetInvite() {
  try {
    localStorage.removeItem(INVITE_KEY);
  } catch {}
}
