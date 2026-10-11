import type { Metadata } from "next";
import { ConfigProvider } from "@/components/ConfigProvider";
import { OrderWizard } from "@/components/order/OrderWizard";
import { getEffectiveConfig } from "@/lib/config/effective";
import { etransferPublic } from "@/lib/payments/etransfer.server";
import { squarePublicConfig } from "@/lib/square/client";

export const metadata: Metadata = {
  title: "3D print your STL file · Instant quote",
  description: "Upload an STL or 3MF file for an instant 3D printing quote. Scale it in the 3D preview, pick PLA, PETG or PLA-CF and a colour, and see the price before you pay.",
  alternates: { canonical: "/order" },
};
export const dynamic = "force-dynamic"; // rates can change in admin settings

export default async function OrderPage() {
  const config = await getEffectiveConfig();
  return (
    <ConfigProvider config={config}>
      <OrderWizard square={squarePublicConfig()} etransfer={etransferPublic()} />
    </ConfigProvider>
  );
}
