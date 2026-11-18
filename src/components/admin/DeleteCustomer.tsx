"use client";
import { useActionState } from "react";
import type { ActionState } from "@/app/admin/actions";
import { deleteCustomerAction } from "@/app/admin/tools-actions";

/** Delete with a "are you sure" first: it can't be undone. */
export function DeleteCustomer({ email, points, hasAccount }: { email: string; points: number; hasAccount: boolean }) {
  const [state, run, pending] = useActionState<ActionState, FormData>(deleteCustomerAction, {});
  const what = [hasAccount && "their account", points > 0 && `${points} points`].filter(Boolean).join(" and ");
  return (
    <form
      action={run}
      onSubmit={(e) => {
        if (!window.confirm(`Delete ${what} for ${email}? Their orders stay. This can't be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="email" value={email} />
      <button type="submit" disabled={pending} className="rounded-full border border-danger/50 px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/10 disabled:opacity-50">
        {pending ? "Deleting…" : hasAccount ? "Delete account" : "Clear points"}
      </button>
      {state.error && <p className="mt-2 text-sm text-danger">{state.error}</p>}
    </form>
  );
}
