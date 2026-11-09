import type { Metadata, Viewport } from "next";
import { KioskApp } from "@/components/kiosk/KioskApp";

// Its own home-screen manifest and name, so "Add to Home Screen" opens the kiosk, not the shop.
export const metadata: Metadata = {
  title: "LightLab self-checkout",
  robots: { index: false, follow: false },
  manifest: "/kiosk/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Kiosk", statusBarStyle: "black-translucent" },
};
// A kiosk shouldn't zoom when shoppers double-tap or pinch.
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };

/** The self-checkout tablet at the LightLab stand. Pairs with LightLab admin > Kiosk. */
export default function KioskPage() {
  return <KioskApp />;
}
