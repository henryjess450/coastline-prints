"use client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { promptInstall, useInstall } from "./install";
import { IosSteps } from "./IosSteps";

const DISMISS_KEY = "cp-install-dismissed";
const QUIET_DAYS = 14;

/**
 * A gentle "Get the app" bar on phones, a few seconds after arriving. Never on
 * checkout or admin, never once installed, and it stays away for two weeks
 * after being closed.
 */
export function InstallBanner() {
  const { ready, installed, ios, canPrompt } = useInstall();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [steps, setSteps] = useState(false);

  useEffect(() => {
    if (!ready || installed || !(ios || canPrompt)) return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    try {
      const last = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      if (Date.now() - last < QUIET_DAYS * 86_400_000) return;
    } catch {
      // Storage blocked: just show it.
    }
    const t = window.setTimeout(() => setShow(true), 6000);
    return () => window.clearTimeout(t);
  }, [ready, installed, ios, canPrompt]);

  const hidden = pathname.startsWith("/order") || pathname.startsWith("/admin") || pathname.startsWith("/app") || pathname.startsWith("/gift-cards");
  function dismiss() {
    setShow(false);
    setSteps(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Ignore.
    }
  }

  return (
    <AnimatePresence>
      {show && !hidden && (
        <motion.div
          initial={{ y: 140, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 140, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-50 rounded-3xl border border-line bg-elev p-4 shadow-[var(--shadow)]"
          role="dialog"
          aria-label="Get the Coastline Prints app"
        >
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">Get the Coastline Prints app</p>
              <p className="text-xs text-muted">Free. Your orders and gift cards, one tap away.</p>
            </div>
            {ios ? (
              <button type="button" onClick={() => setSteps((s) => !s)} className="btn btn-primary h-9 px-4 text-sm">
                How
              </button>
            ) : (
              <button type="button" onClick={async () => (await promptInstall()) && dismiss()} className="btn btn-primary h-9 px-4 text-sm">
                Install
              </button>
            )}
            <button type="button" onClick={dismiss} aria-label="Not now" className="grid h-8 w-8 place-items-center rounded-full text-faint hover:text-fg">
              ×
            </button>
          </div>
          <AnimatePresence initial={false}>
            {steps && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="pt-4">
                  <IosSteps />
                  <Link href="/app" onClick={dismiss} className="mt-3 inline-block text-xs text-accent-text underline underline-offset-4">
                    More about the app
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
