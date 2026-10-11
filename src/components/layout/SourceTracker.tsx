"use client";
import { useEffect } from "react";
import { FIRST_COOKIE, FIRST_DAYS, LAST_COOKIE, LAST_DAYS, touchFrom } from "@/lib/attribution";

const set = (name: string, value: string, days: number) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${days * 86400}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
};

/** Remembers where a visitor came from (see lib/attribution.ts). Runs once per page load; renders nothing. */
export function SourceTracker() {
  useEffect(() => {
    const t = touchFrom(new URL(location.href), document.referrer);
    if (!t) return;
    const value = JSON.stringify(t);
    set(LAST_COOKIE, value, LAST_DAYS);
    if (!document.cookie.split(/;\s*/).some((c) => c.startsWith(`${FIRST_COOKIE}=`))) set(FIRST_COOKIE, value, FIRST_DAYS);
  }, []);
  return null;
}
