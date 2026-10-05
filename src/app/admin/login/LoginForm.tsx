"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { loginAction, type ActionState } from "../actions";

const input = "h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-accent-line focus:shadow-[0_0_0_4px_var(--accent-soft)]";

export function LoginForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(loginAction, {});
  return (
    <form action={action} className="mt-5 space-y-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Username</span>
        <input name="username" autoComplete="username" required className={input} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className={input} />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Checking…" : "Log in"}
      </Button>
    </form>
  );
}
