"use client";
import { MotionConfig } from "framer-motion";
import type { Season } from "@config/seasons";
import { Falling } from "@/components/season/Falling";
import { SeasonProvider } from "@/components/season/SeasonContext";
import { Toaster } from "@/components/ui/Toast";
import { InstallBanner } from "@/components/app/InstallBanner";
import { ServiceWorker } from "./ServiceWorker";

/** reducedMotion="user" makes every Framer animation honour prefers-reduced-motion. */
export function Providers({ season, children }: { season: Season; children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <SeasonProvider season={season}>
        {children}
        {season.falling && <Falling kind={season.falling} />}
      </SeasonProvider>
      <Toaster />
      <ServiceWorker />
      <InstallBanner />
    </MotionConfig>
  );
}
