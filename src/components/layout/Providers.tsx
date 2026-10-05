"use client";
import { MotionConfig } from "framer-motion";
import { Toaster } from "@/components/ui/Toast";

/** reducedMotion="user" makes every Framer animation honour prefers-reduced-motion. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Toaster />
    </MotionConfig>
  );
}
