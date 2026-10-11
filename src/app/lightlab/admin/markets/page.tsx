import { MarketsEditor } from "@/components/lightlab/admin/MarketsEditor";
import { allMarkets } from "@/lib/shop/markets.server";

export const metadata = { title: "Markets" };

export default async function MarketsAdminPage() {
  const { upcoming, past } = await allMarkets();
  return <MarketsEditor upcoming={upcoming} past={past} />;
}
