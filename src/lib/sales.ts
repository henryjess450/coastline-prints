import "server-only";
import type { SaleInfo } from "@/lib/codes/apply";
import { db } from "@/lib/db";

/** The site-wide sale on right now (the biggest, if two overlap), or null. */
export async function liveSale(now = new Date()): Promise<(SaleInfo & { id: string; endsAt: Date }) | null> {
  const s = await db.sale.findFirst({ where: { active: true, startsAt: { lte: now }, endsAt: { gt: now } }, orderBy: { percentOff: "desc" } });
  return s ? { id: s.id, name: s.name, percentOff: s.percentOff, endsAt: s.endsAt } : null;
}
