"use client";
import { useActionState } from "react";
import { savePricingAction, type ActionState } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import type { PricingRates } from "@/lib/config/types";

const input = "h-10 w-full rounded-xl border border-line bg-surface px-3 font-mono text-sm outline-none focus:border-accent-line";

export function PricingForm({ pricing }: { pricing: PricingRates }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(savePricingAction, {});
  const fields = [
    { name: "baseFee", label: "Order fee ($, once per order)", value: pricing.baseFeeCents / 100, step: "0.01" },
    { name: "pricePerGramCents", label: "Filament (¢ per gram)", value: pricing.pricePerGramCents, step: "0.1" },
    { name: "pricePerHour", label: "Machine time ($ per hour)", value: pricing.pricePerHourCents / 100, step: "0.01" },
    { name: "markupPerPiece", label: "Per printed piece ($)", value: pricing.markupPerPieceCents / 100, step: "0.01" },
    { name: "minimumOrder", label: "Minimum order ($)", value: pricing.minimumOrderCents / 100, step: "0.01" },
  ];
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <label key={f.name} className="block">
            <span className="mb-1 block text-xs font-medium text-muted">{f.label}</span>
            <input name={f.name} type="number" min="0" step={f.step} defaultValue={f.value} required className={input} />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save pricing"}
        </Button>
        {state.message && <span className="text-sm text-success">{state.message}</span>}
        {state.error && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
