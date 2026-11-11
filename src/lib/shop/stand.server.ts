import "server-only";
import { randomBytes } from "node:crypto";
import { pickup } from "@config/pickup";
import { db } from "@/lib/db";
import { shopToday } from "./markets.server";
import { standFits, type StandDto } from "./stand";

/** Holds are for half-hour windows, and last until the window ends. */
const WINDOW_MINUTES = 30;
const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

const dayOf = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: pickup.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const minutesNow = (now: Date) => {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: pickup.timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now).split(":").map(Number);
  return h * 60 + m;
};
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const tomorrowOf = (today: string) => {
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

export function parsePacked(s: string): Record<string, number> {
  try {
    const v = JSON.parse(s) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(v).filter(([, n]) => typeof n === "number" && n > 0)) as Record<string, number>;
  } catch {
    return {};
  }
}

/** Packing list: set how many of a lamp (line key "<productId>:<variantId or empty>") went in the van. 0 = not packed. */
export async function setPacked(marketId: string, key: string, count: number) {
  const m = await db.market.findUnique({ where: { id: marketId }, select: { packed: true } });
  if (!m) return;
  const packed = parsePacked(m.packed);
  if (count > 0) packed[key] = Math.min(999, Math.round(count));
  else delete packed[key];
  await db.market.update({ where: { id: marketId }, data: { packed: JSON.stringify(packed) } });
}

/** The pool a sale draws from: the option's own line if it was packed on its own, else the product's. */
function poolOf(packed: Record<string, number>, productId: string, variantId: string | null) {
  return variantId && `${productId}:${variantId}` in packed ? `${productId}:${variantId}` : `${productId}:`;
}

/**
 * The stand to show on the shop: today's market (until it ends) or tomorrow's,
 * with lamps packed for it. What's left = packed, less online reservations for
 * it, less what's sold at the stand that day.
 */
export async function currentStand(now = new Date()): Promise<StandDto | null> {
  const today = shopToday(now);
  const tomorrow = tomorrowOf(today);
  const markets = await db.market.findMany({ where: { date: { in: [today, tomorrow] } }, orderBy: [{ date: "asc" }, { startTime: "asc" }] });
  const mins = minutesNow(now);
  const m = markets.find((x) => (x.date === today ? mins < toMinutes(x.endTime) : true) && Object.keys(parsePacked(x.packed)).length > 0);
  if (!m) return null;
  const packed = parsePacked(m.packed);

  const [holds, sold] = await Promise.all([
    activeHolds(m, now),
    db.order.findMany({ where: { source: m.name, pickupMarketId: null, createdAt: { gte: new Date(now.getTime() - 36 * 3600_000) } }, select: { createdAt: true, items: { select: { productId: true, variantId: true, quantity: true } } } }),
  ]);
  const left = { ...packed };
  const take = (items: { productId: string | null; variantId: string | null; quantity: number }[]) => {
    for (const i of items) {
      if (!i.productId) continue;
      const k = poolOf(packed, i.productId, i.variantId);
      if (k in left) left[k] = Math.max(0, left[k] - i.quantity);
    }
  };
  take(holds.map((h) => ({ productId: h.productId, variantId: h.variantId || null, quantity: h.quantity })));
  for (const o of sold) if (dayOf(o.createdAt) === m.date) take(o.items);

  // Only products still on the shop.
  const live = new Set((await db.shopProduct.findMany({ where: { id: { in: [...new Set(Object.keys(packed).map((k) => k.split(":")[0]))] }, active: true }, select: { id: true } })).map((p) => p.id));
  const out = Object.fromEntries(Object.entries(left).filter(([k]) => live.has(k.split(":")[0])));
  const windows = holdWindows(m, now);
  return { marketId: m.id, name: m.name, place: m.place, date: m.date, startTime: m.startTime, endTime: m.endTime, when: m.date === today ? "today" : "tomorrow", reservable: windows.length > 0, windows, left: out };
}

/** Half-hour windows across the market's hours; today, only ones that haven't ended. */
export function holdWindows(m: { date: string; startTime: string; endTime: string }, now = new Date()) {
  const start = toMinutes(m.startTime);
  const end = toMinutes(m.endTime);
  const after = m.date === shopToday(now) ? minutesNow(now) : -1;
  const out: { start: string; end: string }[] = [];
  for (let t = start; t < end; t += WINDOW_MINUTES) {
    const e = Math.min(end, t + WINDOW_MINUTES);
    if (e > after) out.push({ start: hhmm(t), end: hhmm(e) });
  }
  return out;
}

/** Holds still on: HELD, and (on the day) their window hasn't ended. */
async function activeHolds(m: { id: string; date: string }, now: Date) {
  const holds = await db.standHold.findMany({ where: { marketId: m.id, status: "HELD" } });
  if (m.date !== shopToday(now)) return holds;
  const mins = minutesNow(now);
  return holds.filter((h) => toMinutes(h.slotEnd) > mins);
}

export class HoldError extends Error {}

/** A free hold: checked against what's left at the stand, for a window that's still open. */
export async function createHold(input: { productId: string; variantId: string | null; quantity: number; name: string; email: string; phone: string; slotStart: string }, now = new Date()) {
  const stand = await currentStand(now);
  if (!stand) throw new HoldError("Nothing is at the stand to hold right now.");
  const window = stand.windows.find((w) => w.start === input.slotStart);
  if (!window) throw new HoldError("That time has passed. Please pick another.");
  const qty = Math.max(1, Math.min(5, Math.round(input.quantity)));
  if (!standFits(stand, [{ productId: input.productId, variantId: input.variantId, quantity: qty }])) throw new HoldError(qty > 1 ? "There aren't that many left at the stand." : "That one was just taken. Sorry!");
  const p = await db.shopProduct.findUnique({ where: { id: input.productId }, select: { name: true, variants: true } });
  if (!p) throw new HoldError("That lamp isn't available.");
  const option = input.variantId ? (JSON.parse(p.variants) as { id: string; name: string }[]).find((v) => v.id === input.variantId)?.name : null;
  const hold = await db.standHold.create({
    data: {
      token: randomBytes(18).toString("base64url"),
      marketId: stand.marketId,
      productId: input.productId,
      variantId: input.variantId ?? "",
      label: option ? `${p.name} (${option})` : p.name,
      quantity: qty,
      name: input.name,
      email: input.email,
      phone: input.phone,
      slotStart: window.start,
      slotEnd: window.end,
    },
  });
  await db.outboxJob.createMany({
    data: ["stand-hold-customer", "stand-hold-owner"].map((template) => ({ kind: "email", template, payload: JSON.stringify({ orderId: "", holdId: hold.id }), dedupeKey: `${template}:${hold.id}` })),
  });
  return hold;
}

/** Is a hold still on? (HELD and its window not over.) */
export async function holdIsLive(h: { status: string; marketId: string; slotEnd: string }, now = new Date()) {
  if (h.status !== "HELD") return false;
  const m = await db.market.findUnique({ where: { id: h.marketId }, select: { date: true } });
  if (!m) return false;
  const today = shopToday(now);
  return m.date > today || (m.date === today && toMinutes(h.slotEnd) > minutesNow(now));
}

/** Holds for a market, for the owner: what's on, with names and windows. */
export async function holdsFor(marketId: string, now = new Date()) {
  const m = await db.market.findUnique({ where: { id: marketId }, select: { id: true, date: true } });
  if (!m) return [];
  const rows = await db.standHold.findMany({ where: { marketId }, orderBy: [{ slotStart: "asc" }, { createdAt: "asc" }] });
  const live = new Set((await activeHolds(m, now)).map((h) => h.id));
  return rows.map((h) => ({ id: h.id, label: h.label, quantity: h.quantity, name: h.name, email: h.email, phone: h.phone, slotStart: h.slotStart, slotEnd: h.slotEnd, status: h.status === "HELD" && !live.has(h.id) ? "EXPIRED" : h.status }));
}
