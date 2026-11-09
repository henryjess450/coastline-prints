import type { Metadata } from "next";
import { PosDisplay } from "@/components/pos/PosDisplay";

// Its own home-screen manifest and name, so "Add to Home Screen" opens this screen, not the shop.
export const metadata: Metadata = {
  title: "Register display",
  robots: { index: false, follow: false },
  manifest: "/pos/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Register", statusBarStyle: "black-translucent" },
};

/** The customer-facing tablet at the register. Pairs with /admin/pos by a code. */
export default function PosDisplayPage() {
  return <PosDisplay />;
}
