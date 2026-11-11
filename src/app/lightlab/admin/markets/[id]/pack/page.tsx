import { notFound } from "next/navigation";
import { PackingChecklist } from "@/components/lightlab/admin/PackingChecklist";
import { packingList } from "@/lib/shop/packing.server";
import { holdsFor } from "@/lib/shop/stand.server";

export const metadata = { title: "Packing list" };

/** What to bring to a market day: pickup orders, lamps and the stand kit, to tick off while loading up. */
export default async function PackingListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const list = await packingList(id);
  if (!list) notFound();
  return <PackingChecklist list={list} holds={await holdsFor(id)} />;
}
