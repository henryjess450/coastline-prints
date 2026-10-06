"use client";
import { MotionConfig } from "framer-motion";
import { Toaster } from "@/components/ui/Toast";
import { InstallBanner } from "@/components/app/InstallBanner";
import { ServiceWorker } from "./ServiceWorker";

/** reducedMotion="user" makes every Framer animation honour prefers-reduced-motion. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Toaster />
      <ServiceWorker />
      <InstallBanner />
    </MotionConfig>
  );
}
