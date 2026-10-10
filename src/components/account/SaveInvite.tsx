"use client";
import { useEffect } from "react";

/** Where checkout looks for an invite code to add by itself. */
export const INVITE_KEY = "cp-invite";

/** Keeps the invite code in this browser until it's used at checkout. */
export function SaveInvite({ code }: { code: string }) {
  useEffect(() => {
    try {
      localStorage.setItem(INVITE_KEY, code);
    } catch {
      // Private mode: they can still type the code at checkout.
    }
  }, [code]);
  return null;
}
