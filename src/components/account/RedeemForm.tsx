"use client";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { bounce, Button } from "@/components/ui/Button";
import { isCardNumber } from "@/lib/codes/apply";
import type { WalletItem } from "@/lib/account/wallet";

const input = "h-12 w-full rounded-xl border border-line bg-surface px-4 font-mono text-base uppercase text-fg outline-none transition-[border-color,box-shadow] placeholder:text-faint placeholder:normal-case focus:border-accent-line focus:shadow-[0_0_0_4px_var(--accent-soft)]";

/** Type a gift card (number + PIN) or coupon number to save it to the account. */
export function RedeemForm({ onSaved }: { onSaved?: (item: WalletItem) => void }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<WalletItem | null>(null);
  const shake = useAnimationControls();
  const button = useRef<HTMLButtonElement>(null);
  const card = isCardNumber(code);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/account/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, pin: card ? pin : undefined }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "That didn't work. Check the number and try again.");
      void shake.start({ x: [0, -8, 8, -5, 5, 0], transition: { duration: 0.4 } });
      return;
    }
    bounce(button.current);
    setSaved(data.item);
    setCode("");
    setPin("");
    onSaved?.(data.item);
    router.refresh();
  }

  return (
    <form onSubmit={save}>
      <motion.div animate={shake} className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          <label htmlFor="redeem-code" className="mb-1.5 block text-xs font-medium text-muted">
            Gift card or coupon number
          </label>
          <input id="redeem-code" value={code} onChange={(e) => (setCode(e.target.value), setError(""))} placeholder="1234 5678 1234 5678" autoComplete="off" className={input} />
        </div>
        <AnimatePresence initial={false}>
          {card && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="sm:w-40">
              <label htmlFor="redeem-pin" className="mb-1.5 block text-xs font-medium text-muted">
                PIN
              </label>
              <input id="redeem-pin" value={pin} onChange={(e) => (setPin(e.target.value), setError(""))} placeholder="CP#####" autoComplete="off" className={input} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <Button ref={button} type="submit" size="lg" className="mt-5 w-full sm:w-auto" disabled={busy || !code.trim() || (card && !pin.trim())}>
        {busy ? "Saving…" : "Save to my account"}
      </Button>
      <AnimatePresence>
        {error && (
          <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </motion.p>
        )}
        {saved && !error && (
          <motion.p role="status" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 rounded-xl border border-success/40 bg-success/10 p-3 text-sm text-success">
            Saved! {saved.title}. It&apos;s locked to your account and ready to tap at checkout.
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  );
}
