"use client";
import { useEffect, useRef } from "react";
import { bounce } from "./Button";
import { toast } from "./Toast";

/**
 * After a form's server action finishes: toast its message, and bounce the
 * submit button on success. Pass the state from useActionState.
 */
export function useFormFeedback(state: { message?: string; error?: string }, button: React.RefObject<HTMLButtonElement | null>) {
  const seen = useRef(state);
  useEffect(() => {
    if (state === seen.current) return;
    seen.current = state;
    if (state.error) toast(state.error, "error");
    else if (state.message) {
      toast(state.message, "success");
      bounce(button.current);
    }
  }, [state, button]);
}
