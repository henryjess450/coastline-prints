import type { Metadata } from "next";
import { BenchyIcon } from "@/components/brand/Benchy";
import { RetryButton } from "./RetryButton";

export const metadata: Metadata = { title: "You're offline", robots: { index: false } };

/** Shown by the app (service worker) when a page can't load because there's no connection. */
export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <BenchyIcon size={120} />
      <h1 className="mt-8 font-display text-4xl font-bold tracking-tight">You&apos;re offline</h1>
      <p className="mt-4 leading-relaxed text-muted">Looks like there&apos;s no connection right now. Check your Wi-Fi or data, then try again.</p>
      <RetryButton />
    </div>
  );
}
