"use client";
import { useEffect, useState } from "react";
import { Confetti } from "./Confetti";

export const WELCOME_FLAG = "cp-just-signed-in";

/** Confetti the moment someone signs in (the sign-in box leaves a flag just before refreshing). */
export function WelcomeBurst() {
  const [go, setGo] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(WELCOME_FLAG)) {
        sessionStorage.removeItem(WELCOME_FLAG);
        const t = window.setTimeout(() => setGo(true), 400);
        return () => window.clearTimeout(t);
      }
    } catch {
      // Storage blocked: no confetti, no problem.
    }
  }, []);
  return go ? <Confetti /> : null;
}
