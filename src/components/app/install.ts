"use client";
import { useEffect, useState } from "react";

/**
 * Install support. Android/Chrome fires `beforeinstallprompt`; we keep it so
 * our own "Install" button can show the real prompt later. iPhone Safari has
 * no install prompt at all, so iPhone users get Share → Add to Home Screen steps.
 */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export type Platform = { ready: boolean; installed: boolean; ios: boolean; canPrompt: boolean };

export function useInstall() {
  const [state, setState] = useState<Platform>({ ready: false, installed: false, ios: false, canPrompt: false });
  useEffect(() => {
    const read = () => {
      const nav = navigator as Navigator & { standalone?: boolean };
      const ios = /iphone|ipad|ipod/i.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
      setState({ ready: true, installed: window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true, ios, canPrompt: !!deferred });
    };
    read();
    listeners.add(read);
    return () => void listeners.delete(read);
  }, []);
  return state;
}

/** Shows Android's install prompt. Returns true if they installed. */
export async function promptInstall() {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  notify();
  return outcome === "accepted";
}
