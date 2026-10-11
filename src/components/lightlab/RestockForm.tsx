"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAccount } from "@/components/account/use-account";

/** Sold out: leave an email and hear the moment it's back. */
export function RestockForm({ productId, variantId, label }: { productId: string; variantId: string | null; label: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ status: "idle" | "busy" | "done" | "error"; message?: string }>({ status: "idle" });
  // Signed in: fill in their email.
  useAccount((a) => {
    if (a.signedIn && a.email) setEmail((e) => e || a.email!);
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "busy" });
    const res = await fetch("/api/shop/restock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, variantId, email }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) setState({ status: "done" });
    else setState({ status: "error", message: data.error ?? "Couldn't save that. Please try again." });
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {state.status === "done" ? (
        <motion.p key="done" role="status" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-accent-soft p-4 text-sm">
          Got it. We&apos;ll email <strong>{email}</strong> as soon as {label} is back.
        </motion.p>
      ) : (
        <motion.form key="form" onSubmit={submit} exit={{ opacity: 0 }} className="w-full">
          <label htmlFor="restock-email" className="mb-2 block text-sm font-medium">
            Tell me when it&apos;s back
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="restock-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 min-w-0 flex-1 basis-56 rounded-full border border-line bg-elev px-5 text-sm outline-none focus:border-accent-line focus:shadow-[0_0_0_4px_var(--accent-soft)]"
            />
            <Button type="submit" size="lg" disabled={state.status === "busy"}>
              {state.status === "busy" ? "Saving…" : "Notify me"}
            </Button>
          </div>
          {state.status === "error" && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {state.message}
            </p>
          )}
          <p className="mt-2 text-xs text-faint">One email when it&apos;s restocked, nothing else.</p>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
