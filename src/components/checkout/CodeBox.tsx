"use client";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useRef, useState } from "react";
import { bounce } from "@/components/ui/Button";
import { applyCodes, isCardNumber, MAX_CODES, normalizeCode, normalizePin, type ApplyResult, type CodeInfo } from "@/lib/codes/apply";
import { money } from "@/lib/format";

/**
 * "Coupons or Gift Cards? Add them here!" with applied codes as removable chips.
 * A rejected code shakes the input; an accepted one bounces Apply and the new
 * chip wobbles in.
 */
export function CodeBox({
  orderTotalCents,
  codes,
  result,
  onChange,
  disabled,
}: {
  orderTotalCents: number;
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

  async function add() {
    const code = normalizeCode(value);
    if (!code) return;
    if (codes.some((c) => c.code === code)) return setError("That code is already added.");
    if (codes.length >= MAX_CODES) return setError(`You can add up to ${MAX_CODES} codes.`);
    const cardPin = card ? normalizePin(pin) : "";
    if (card && cardPin.length !== 7) return setError("Enter the gift card PIN (CP and 5 numbers).");
    setChecking(true);
    setError(undefined);
    try {
      const res = await fetch("/api/codes/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, pin: cardPin || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(body.error ?? "That code isn't valid.");
      const next = [...codes, { ...(body.code as CodeInfo), pin: cardPin || undefined }];
      const why = applyCodes(orderTotalCents, next).rejected.find((r) => r.code === code);
      if (why) return setError(why.reason);
      onChange(next);
      bounce(applyBtn.current);
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
        <button ref={applyBtn} type="button" onClick={add} disabled={disabled || checking || !value.trim()} className="btn btn-secondary h-10 px-4 text-sm">
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
