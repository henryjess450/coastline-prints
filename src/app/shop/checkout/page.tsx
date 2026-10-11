import type { Metadata } from "next";
import { ConfigProvider } from "@/components/ConfigProvider";
import { ShopCheckout } from "@/components/lightlab/ShopCheckout";
import { getEffectiveConfig } from "@/lib/config/effective";
import { etransferPublic } from "@/lib/payments/etransfer.server";
import { squarePublicConfig } from "@/lib/square/client";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The same checkout as a print order, for the Coastline shop cart. */
export default async function ShopCheckoutPage() {
  return (
    <ConfigProvider config={await getEffectiveConfig()}>
      <ShopCheckout square={squarePublicConfig()} etransfer={etransferPublic()} shop="coastline" />
    </ConfigProvider>
  );
}
