"use client";
import { usePathname } from "next/navigation";

/** The LightLab pages get a bare footer (just the Canadian flag); everywhere else gets the full one. */
export function FooterSwitch({ full, lightlab }: { full: React.ReactNode; lightlab: React.ReactNode }) {
  return usePathname().startsWith("/lightlab") ? lightlab : full;
}
