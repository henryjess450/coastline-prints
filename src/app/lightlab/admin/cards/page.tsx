import { CardMaker } from "@/components/lightlab/admin/CardMaker";
import { CARD_DEFAULTS, listCardBatches } from "@/lib/codes/thank-you";

export const metadata = { title: "Thank-you cards" };

export default async function ThankYouCardsPage() {
  return <CardMaker batches={await listCardBatches()} defaults={CARD_DEFAULTS} />;
}
