import type { GiftBonus } from "@config/promotions";
import { money } from "@/lib/format";

/** On, and today (shop time, "YYYY-MM-DD") is within its dates. */
export const bonusLive = (b: GiftBonus | null, today: string): b is GiftBonus => !!b && b.on && b.bonusCents > 0 && today >= b.startsOn && today <= b.endsOn;

/** Extra value for a gift card of this amount bought today. */
export function bonusFor(amountCents: number, b: GiftBonus | null, today: string) {
  return bonusLive(b, today) && amountCents >= b.minCents ? b.bonusCents : 0;
}

const longDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-CA", { month: "long", day: "numeric" });

/** "$5 extra on gift cards of $50 or more, until December 24" */
export function bonusLine(b: GiftBonus) {
  const whole = (c: number) => money(c).replace(".00", "");
  return `${whole(b.bonusCents)} extra on gift cards of ${whole(b.minCents)} or more, until ${longDay(b.endsOn)}`;
}
