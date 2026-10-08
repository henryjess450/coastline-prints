"use client";
import { useActionState, useRef } from "react";
import { confirmEtransferAction, type ActionState } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { useFormFeedback } from "@/components/ui/useFormFeedback";
import { cn } from "@/lib/cn";

type Choice = { id: string; label: string };

/** Pay an order from a deposit (pick which order), or mark a waiting order received. */
export function ConfirmEtransfer({ depositId, checkoutId, choices, suggested, label }: { depositId?: string; checkoutId?: string; choices?: Choice[]; suggested?: string; label: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(confirmEtransferAction, {});
  const button = useRef<HTMLButtonElement>(null);
  useFormFeedback(state, button);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Only confirm once you've seen this money in your Scotiabank account. Confirm?")) e.preventDefault();
      }}
      className="flex flex-wrap items-center gap-2"
    >
      {depositId && <input type="hidden" name="depositId" value={depositId} />}
      {checkoutId ? (
        <input type="hidden" name="checkoutId" value={checkoutId} />
      ) : (
        <select name="checkoutId" defaultValue={suggested ?? ""} className="h-9 rounded-full border border-line bg-surface px-3 text-sm">
          <option value="">Which order?</option>
          {choices?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      )}
      <Button ref={button} type="submit" size="sm" disabled={pending}>
        {pending ? "Confirming…" : label}
      </Button>
      {(state.error || state.message) && <span className={cn("text-sm", state.error ? "text-danger" : "text-success")}>{state.error ?? state.message}</span>}
    </form>
  );
}
