"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useActionState, useState } from "react";
import { createCodeAction, type CodeActionState } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";

const field = "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-accent-line";
type Kind = "PERCENT" | "AMOUNT" | "GIFT_CARD";

export function CreateCodeForm() {
  const [kind, setKind] = useState<Kind>("PERCENT");
  const [state, action, pending] = useActionState<CodeActionState, FormData>(createCodeAction, {});
  const gift = kind === "GIFT_CARD";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      <Segmented<Kind>
        label="Type"
        value={kind}
        onChange={setKind}
        options={[
          { value: "PERCENT", label: "% off coupon" },
          { value: "AMOUNT", label: "$ off coupon" },
          { value: "GIFT_CARD", label: "Gift card" },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-xs text-muted">
          {kind === "PERCENT" ? "Percent off" : gift ? "Gift card value ($)" : "Dollars off ($)"}
          <input name="value" type="number" min={kind === "PERCENT" ? 1 : 0.01} max={kind === "PERCENT" ? 100 : undefined} step={kind === "PERCENT" ? 1 : 0.01} required className={`${field} mt-1 font-mono`} />
        </label>
        <label className="block text-xs text-muted">
          Code (blank = random)
          <input name="code" placeholder={gift ? "GC-XXXX-XXXX-XXXX" : "e.g. SUMMER10"} autoCapitalize="characters" className={`${field} mt-1 font-mono uppercase`} />
        </label>
        <label className="block text-xs text-muted">
          Expires (optional)
          <input name="expires" type="date" className={`${field} mt-1`} />
        </label>
        {!gift && (
          <>
            <label className="block text-xs text-muted">
              Max uses (blank = unlimited)
              <input name="maxUses" type="number" min={1} step={1} className={`${field} mt-1 font-mono`} />
            </label>
            <label className="block text-xs text-muted">
              Minimum order ($)
              <input name="minOrder" type="number" min={0} step={0.01} defaultValue={0} className={`${field} mt-1 font-mono`} />
            </label>
          </>
        )}
        <label className="block text-xs text-muted sm:col-span-2 lg:col-span-1">
          Note (only you see this)
          <input name="note" maxLength={200} placeholder={gift ? "Who it's for" : "What it's for"} className={`${field} mt-1`} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="print" defaultChecked className="h-4 w-4 accent-[var(--accent)]" /> Print a {gift ? "gift card" : "coupon"} slip on the receipt printer
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : gift ? "Create gift card" : "Create coupon"}
        </Button>
        {state.error && <span className="text-sm text-danger">{state.error}</span>}
      </div>
      <AnimatePresence>
        {state.created && !pending && (
          <motion.div key={state.created} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 rounded-2xl bg-success/15 p-4">
            <span className="text-sm text-success">Created:</span>
            <code className="font-mono text-lg font-bold">{state.created}</code>
            <button type="button" onClick={() => navigator.clipboard?.writeText(state.created!)} className="rounded-full border border-line px-3 py-1 text-xs hover:border-accent-line">
              Copy
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
