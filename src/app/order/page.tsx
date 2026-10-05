import type { Metadata } from "next";
import { ConfigProvider } from "@/components/ConfigProvider";
import { OrderWizard } from "@/components/order/OrderWizard";
import { getEffectiveConfig } from "@/lib/config/effective";
import { squarePublicConfig } from "@/lib/square/client";

export const metadata: Metadata = { title: "Start an order" };
export const dynamic = "force-dynamic"; // rates can change in admin settings

export default async function OrderPage() {
  const config = await getEffectiveConfig();
  return (
    <ConfigProvider config={config}>
      <OrderWizard square={squarePublicConfig()} />
    </ConfigProvider>
  );
}
