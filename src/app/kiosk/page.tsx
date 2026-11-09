import type { Metadata, Viewport } from "next";
import { KioskApp } from "@/components/kiosk/KioskApp";

export const metadata: Metadata = { title: "LightLab self-checkout", robots: { index: false, follow: false } };
// A kiosk shouldn't zoom when shoppers double-tap or pinch.
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };

/** The self-checkout tablet at the LightLab stand. Pairs with LightLab admin > Kiosk. */
export default function KioskPage() {
  return <KioskApp />;
}
