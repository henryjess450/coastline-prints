"use client";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { promptInstall, useInstall } from "./install";
import { IosSteps } from "./IosSteps";

/** The /app page: what the app does, and how to install it on this phone. */
export function GetTheApp() {
  const { ready, installed, ios, canPrompt } = useInstall();
  return (
    <div className="space-y-6">
      <div className="text-center">
        <motion.img src="/icons/icon-512.png" alt="Coastline Prints app icon" width={112} height={112} className="mx-auto h-28 w-28 rounded-[28px] shadow-[var(--shadow)]" initial={{ scale: 0.8, rotate: -6, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }} />
        <h1 className="mt-8 font-display text-4xl font-bold tracking-tight sm:text-5xl">Get the app</h1>
        <p className="mx-auto mt-4 max-w-lg leading-relaxed text-muted">Put Coastline Prints on your home screen. It opens full screen like any app, and it&apos;s free, with nothing to download from an app store.</p>
      </div>

      <Card flat className="p-6 sm:p-8">
        <ul className="grid gap-4 sm:grid-cols-3">
          {[
            ["Order in a tap", "Upload an STL and see your price straight from your home screen."],
            ["Track your prints", "Check where your order is, any time."],
            ["Cards and coupons", "Your saved gift cards and coupons, ready at checkout."],
          ].map(([title, body]) => (
            <li key={title}>
              <p className="font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </Card>

      {ready && installed ? (
        <Card flat className="p-6 text-center sm:p-8">
          <p className="font-display text-xl font-bold">You&apos;re using the app ✓</p>
          <p className="mt-2 text-sm text-muted">It&apos;s already on your home screen.</p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card flat className={`p-6 sm:p-8 ${ready && ios ? "ring-2 ring-accent-line" : ""}`}>
            <h2 className="font-display text-xl font-bold">iPhone and iPad</h2>
            <div className="mt-5">
              <IosSteps />
            </div>
          </Card>
          <Card flat className={`p-6 sm:p-8 ${ready && !ios ? "ring-2 ring-accent-line" : ""}`}>
            <h2 className="font-display text-xl font-bold">Android</h2>
            {canPrompt ? (
              <>
                <p className="mt-3 text-sm leading-relaxed text-muted">Tap below and confirm. The icon appears on your home screen.</p>
                <Button size="lg" className="mt-5 w-full" onClick={() => void promptInstall()}>
                  Install the app
                </Button>
              </>
            ) : (
              <ol className="mt-5 space-y-3">
                {["Open this site in Chrome.", "Tap the ⋮ menu at the top right.", "Tap Install app (or Add to Home screen).", "Tap Install. The icon appears on your home screen."].map((step, i) => (
                  <li key={step} className="flex gap-3 text-sm leading-relaxed text-muted">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-ink">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
