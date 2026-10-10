import { notFound } from "next/navigation";
import { SeaPage } from "@/components/account/sea/SeaPage";
import { SeaSection } from "@/components/account/sea/SeaSection";
import { Board } from "@/components/admin/Board";
import type { AdminCard } from "@/components/admin/OrderCard";
import { AdminHero } from "@/components/admin/today/AdminHero";
import { TaskGroup } from "@/components/admin/today/TaskGroup";
import { BOARD, nextStep } from "@/lib/orders/next-step";

export const metadata = { title: "Admin preview", robots: { index: false } };

const card = (n: number, status: string, over: Partial<AdminCard> = {}): AdminCard => ({
  id: `sample-${n}`,
  orderNumber: `CP-2610-S${n}X${n}`,
  status,
  fulfillment: "PICKUP",
  customer: ["Sam Rivers", "Alex Chen", "Jordan Lee", "Priya Shah", "Morgan Bell", "Riley Ford"][n % 6],
  firstName: ["Sam", "Alex", "Jordan", "Priya", "Morgan", "Riley"][n % 6],
  returning: n % 3 === 0,
  summary: ["dragon-keychain.stl × 2 · PLA Green", "phone-stand.3mf × 1 · PETG Black", "xmas_tree_2024.3mf × 4 · PLA Red Matte"][n % 3],
  more: n % 4 === 0 ? 2 : 0,
  pieces: 2 + (n % 3),
  printers: n % 2 ? "P1S" : "A1",
  printTime: `${2 + (n % 4)} h ${10 * (n % 6)} min`,
  when: "Wednesday, October 14, 5 to 6 pm",
  due: (["today", "tomorrow", "later", "late"] as const)[n % 4],
  total: `$${(14 + n * 7).toFixed(2)}`,
  next: nextStep(status, over.fulfillment ?? "PICKUP"),
  ...over,
});

/** DEV ONLY: the admin Today page and board with sample orders (buttons don't save here). 404 in production. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  const ship = card(4, "POST_PROCESSING", { fulfillment: "SHIP", when: "Ship to Halifax, NS", due: null, next: nextStep("POST_PROCESSING", "SHIP", true) });
  const cards = [card(1, "PAID"), card(2, "QUEUED"), card(3, "PRINTING"), ship, card(5, "POST_PROCESSING"), card(6, "READY_FOR_PICKUP", { due: "today" }), card(7, "PICKED_UP", { due: null })];
  return (
    <SeaPage hero={<AdminHero hello="Good afternoon!" date="Friday, October 9" todo={5} stats={[{ label: "Orders this week", value: "7" }, { label: "Print sales this week", value: "$184.20" }, { label: "On the go", value: "6" }]} />}>
      <div className="mx-auto max-w-6xl px-4 pb-32 pt-12 sm:px-6">
        <SeaSection id="todo" label="Needs you" title="Your to-do list" intro="Most urgent first. Tap the button on a card to move it along.">
          <TaskGroup title="Pickups today" hint="Hand these over, then tap Picked up." cards={[cards[5]]} />
          <TaskGroup title="Pack and ship" hint="Print the label, pack it up, then mark it shipped. The customer is emailed." cards={[ship]} />
          <TaskGroup title="New orders" hint="Check the files look printable, then queue them." cards={[cards[0], cards[1]]} showPrint />
        </SeaSection>
        <SeaSection id="board" label="Board" title="Orders">
          <Board columns={BOARD.map((c) => ({ id: c.id, title: c.title, cards: cards.filter((x) => (c.statuses as readonly string[]).includes(x.status)).map((x) => ({ ...x, id: `${x.id}-b` })) }))} />
        </SeaSection>
      </div>
    </SeaPage>
  );
}
