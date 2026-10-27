"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { PosScreen } from "@/lib/pos/types";
import { CustomerScreen } from "./CustomerScreen";

type State = { paired: boolean; pairCode: string | null; screen: PosScreen; version: number };

const POLL_MS = 1000;

/**
 * The customer display. Shows a pair code until the cashier enters it on the
 * register, then follows what the register pushes, a second behind at most.
 * Keeps the tablet's screen awake while open.
 */
export function PosDisplay() {
  const [state, setState] = useState<State | null>(null);
  const [offline, setOffline] = useState(false);
  const version = useRef(-1);

  const load = useCallback(async () => {
    try {
      let res = await fetch("/api/pos/display", { cache: "no-store" });
      if (res.status === 404) res = await fetch("/api/pos/display", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as State;
      setOffline(false);
      if (next.version !== version.current || !next.paired) {
        version.current = next.version;
        setState(next);
      }
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState === "visible") await load();
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [load]);

  // Keep the screen on (Safari 16.4+, Chrome). Re-asked when the tab comes back.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const ask = async () => {
      try {
        if (document.visibilityState === "visible" && "wakeLock" in navigator) lock = await (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen");
      } catch {}
    };
    ask();
    document.addEventListener("visibilitychange", ask);
    return () => {
      document.removeEventListener("visibilitychange", ask);
      lock?.release().catch(() => undefined);
    };
  }, []);

  async function sendEmail(email: string) {
    const res = await fetch("/api/pos/display/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    if (res.ok) {
      await load();
      return null;
    }
    return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That didn't work. Try again.";
  }

  const dot = <span title={offline ? "Can't reach the register" : "Connected"} className={cn("h-2.5 w-2.5 rounded-full", offline ? "bg-danger" : "bg-success/60")} />;

  if (!state) return <div className="fixed inset-0 z-[200] grid place-items-center bg-bg text-muted">{offline ? "Can't reach the server. Retrying..." : "Starting..."}</div>;
  if (!state.paired) {
    return (
      <div className="fixed inset-0 z-[200] grid place-items-center bg-bg px-6 text-center text-fg">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Customer display</p>
          <p className="mt-6 font-mono text-7xl font-bold tracking-[0.2em] sm:text-8xl">{state.pairCode}</p>
          <p className="mx-auto mt-6 max-w-md text-lg text-muted">On the register, open Admin, then Register, then &ldquo;Pair a display&rdquo; and type this code.</p>
        </div>
      </div>
    );
  }
  return <CustomerScreen screen={state.screen} onEmail={sendEmail} corner={dot} />;
}
