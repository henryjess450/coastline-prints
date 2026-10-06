"use client";
import { useEffect, useRef, useState } from "react";

export type AccountProfile = { signedIn: true; email: string; name: string; phone: string; theme: "light" | "dark" | null } | { signedIn: false };

/**
 * The signed-in customer's saved details (or `{ signedIn: false }`), null
 * while loading. Checked again when the tab regains focus, in case they
 * just signed in from another tab. `onLoad` runs each time it's fetched.
 */
export function useAccount(onLoad?: (a: AccountProfile) => void) {
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const callback = useRef(onLoad);
  useEffect(() => {
    callback.current = onLoad;
  });
  useEffect(() => {
    const load = () =>
      fetch("/api/account/me")
        .then((r) => (r.ok ? r.json() : null))
        .then((a: AccountProfile | null) => {
          if (!a) return;
          setAccount(a);
          callback.current?.(a);
        }, () => undefined);
    void load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, []);
  return account;
}
