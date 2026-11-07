import type { Metadata } from "next";
import { ConfigProvider } from "@/components/ConfigProvider";
import { ShopCheckout } from "@/components/lightlab/ShopCheckout";
import { getEffectiveConfig } from "@/lib/config/effective";
import { etransferPublic } from "@/lib/payments/etransfer.server";
import { squarePublicConfig } from "@/lib/square/client";
import { listProducts } from "@/lib/shop/products.server";
import { pickupMarkets } from "@/lib/shop/market-pickup.server";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The same checkout as a print order, for the LightLab cart. */
export default async function LightLabCheckoutPage() {
  return (
    <ConfigProvider config={await getEffectiveConfig()}>
      <ShopCheckout square={squarePublicConfig()} etransfer={etransferPublic()} products={await listProducts({ shop: "lightlab" })} markets={await pickupMarkets()} />
    </ConfigProvider>
  );
}
