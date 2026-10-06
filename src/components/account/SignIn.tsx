"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { bounce, Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { BuddyState } from "./fun/AccountBuddy";
import { WELCOME_FLAG } from "./fun/WelcomeBurst";

const input = "h-12 w-full rounded-xl border border-line bg-surface px-4 text-base text-fg outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-accent-line focus:shadow-[0_0_0_4px_var(--accent-soft)]";

/**
 * Sign in with a 6-digit code sent by email. No passwords. Refreshes the page
 * when done. `onState` tells an AccountBuddy what's going on, so it can react.
 */
export function SignIn({ intro, onState }: { intro?: string; onState?: (s: BuddyState) => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; n: number } | null>(null);
  const [focused, setFocused] = useState(false);
  const [done, setDone] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const fail = (text: string) => setError((e) => ({ text, n: (e?.n ?? 0) + 1 }));

  const mood = done ? "happy" : busy ? "busy" : error ? "error" : step === "code" ? "waiting" : focused || email ? "typing" : "idle";
  // Eyes follow along the email as it's typed, and across the code boxes.
  const lookX = step === "code" ? -0.8 + (code.length / 6) * 1.6 : -0.8 + (Math.min(email.length, 28) / 28) * 1.6;
  const lookY = mood === "busy" ? -1 : 1;
  const errorKey = error?.n;
  useEffect(() => {
    onState?.({ mood, look: { x: mood === "busy" || mood === "happy" ? 0 : lookX, y: mood === "happy" ? 0 : lookY }, errorKey });
  }, [onState, mood, lookX, lookY, errorKey]);

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const r = await post("/api/account/code", { email });
    setBusy(false);
    if (!r.ok) return fail(r.data.error ?? "We couldn't send the code. Please try again.");
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await post("/api/account/verify", { email, code });
    if (!r.ok) {
      setBusy(false);
      return fail(r.data.error ?? "That code didn't work.");
    }
    bounce(button.current);
    setDone(true);
    // Confetti on the next screen.
    try {
      sessionStorage.setItem(WELCOME_FLAG, "1");
    } catch {
      // Ignore.
    }
    // Let the buddy have its little celebration first.
    if (onState) await new Promise((r) => setTimeout(r, 1100));
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md">
      {intro && <p className="mb-6 leading-relaxed text-muted">{intro}</p>}
      <AnimatePresence mode="wait" initial={false}>
        {step === "email" ? (
          <motion.form key="email" onSubmit={sendCode} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}>
            <label htmlFor="account-email" className="mb-1.5 block text-xs font-medium text-muted">
              Your email
            </label>
            <input id="account-email" type="email" autoComplete="email" required value={email} onChange={(e) => (setEmail(e.target.value), setError(null))} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} className={input} />
            <Button type="submit" size="lg" className="mt-5 w-full" disabled={busy || !email.trim()}>
              {busy ? "Sending…" : "Email me a sign-in code"}
            </Button>
            <p className="mt-4 text-center text-xs text-faint">No password needed. New here? This makes your account.</p>
          </motion.form>
        ) : (
          <motion.form key="code" onSubmit={verify} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.22 }}>
            <motion.svg width="64" height="48" viewBox="0 0 64 48" className="mx-auto mb-4 text-accent-text" initial={{ x: -60, y: 20, rotate: -15, opacity: 0 }} animate={{ x: [-60, 0, 0], y: [20, 0, -4, 0], rotate: [-15, 6, 0], opacity: 1 }} transition={{ duration: 0.8, ease: "easeOut" }} aria-hidden>
              <rect x="4" y="8" width="56" height="36" rx="6" fill="var(--accent)" />
              <path d="M6 12l26 18 26-18" fill="none" stroke="#86bbea" strokeWidth="3" strokeLinejoin="round" />
              <motion.circle cx="54" cy="10" r="7" fill="var(--sand)" initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ delay: 0.7, duration: 0.35 }} />
            </motion.svg>
            <p className="mb-4 text-center text-sm leading-relaxed text-muted">
              We sent a 6-digit code to <strong className="text-fg">{email}</strong>. It works for 10 minutes.
            </p>
            <label htmlFor="account-code" className="sr-only">
              Sign-in code
            </label>
            <div className="relative">
              <div className="grid grid-cols-6 gap-2" aria-hidden>
                {Array.from({ length: 6 }, (_, i) => {
                  const digit = code[i];
                  const active = i === Math.min(code.length, 5);
                  return (
                    <motion.div
                      key={i}
                      className={cn(
                        "grid h-14 place-items-center rounded-xl border-2 bg-surface font-mono text-2xl font-bold transition-colors",
                        digit ? "border-accent-line text-fg" : active ? "border-accent-line/60" : "border-line",
                      )}
                      animate={digit ? { scale: [1, 1.15, 1], y: [0, -4, 0] } : { scale: 1 }}
                      transition={{ duration: 0.25 }}
                    >
                      <AnimatePresence mode="popLayout">
                        {digit && (
                          <motion.span key={digit + i} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>
                            {digit}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {!digit && active && <motion.span className="h-6 w-0.5 rounded bg-accent-line" animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} />}
                    </motion.div>
                  );
                })}
              </div>
              <input
                id="account-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => (setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6)), setError(null))}
                className="absolute inset-0 h-full w-full cursor-text opacity-0"
              />
            </div>
            <Button ref={button} type="submit" size="lg" className="mt-5 w-full" disabled={busy || code.length !== 6}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <div className="mt-4 flex justify-between text-sm">
              <button type="button" className="text-muted underline-offset-4 hover:text-fg hover:underline" onClick={() => (setStep("email"), setCode(""), setError(null))}>
                Use a different email
              </button>
              <button type="button" className="text-accent-text underline-offset-4 hover:underline" disabled={busy} onClick={() => void sendCode()}>
                Send a new code
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {error && (
          <motion.p key={error.n} role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0, x: [0, -6, 6, -3, 0] }} exit={{ opacity: 0 }} className="mt-4 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            {error.text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
