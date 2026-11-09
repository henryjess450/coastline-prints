import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { logError } from "@/lib/api";
import { cancelPayLink, createPayLink, payLinkStatus, payLinksAvailable } from "@/lib/pos/paylink.server";
import { pricePos, publicQuote } from "@/lib/pos/price.server";
import { PosSaleError, ringUpSale } from "@/lib/pos/sale.server";
import { PAIR_ALPHABET, PAIR_LENGTH, normalizePairCode, orderMinDate, type PosCartInput } from "@/lib/pos/types";
import { shopLineSchema } from "@/lib/shop/schema";

/*
 * The self-checkout kiosk at the LightLab stand. A tablet opens /kiosk, gets a
 * cookie and shows a pairing code; the owner types the code in LightLab admin
 * > Kiosk. From then on the tablet can price carts and start sales. The server
 * keeps each sale's cart and Square payment link, and rings the sale up (the
 * same way as the register) once Square says the shopper has paid on their
 * phone. The tablet never decides what's paid.
 */

export const KIOSK_COOKIE = "cp_kiosk";
export const KIOSK_SOURCE = "LightLab kiosk";

const pairCode = () => Array.from(randomBytes(PAIR_LENGTH), (n) => PAIR_ALPHABET[n % PAIR_ALPHABET.length]).join("");

/** This tablet's kiosk, made (unpaired) on its first visit. */
export async function kioskForThisDevice(create = false) {
  const jar = await cookies();
  const token = jar.get(KIOSK_COOKIE)?.value;
  let kiosk = token ? await db.kiosk.findUnique({ where: { token } }) : null;
  if (!kiosk && create) {
    // Clear out tablets that never got paired.
    await db.kiosk.deleteMany({ where: { pairedAt: null, createdAt: { lt: new Date(Date.now() - 86_400_000) } } });
    for (let i = 0; i < 5 && !kiosk; i++) {
      const code = pairCode();
      if (await db.kiosk.findUnique({ where: { pairCode: code } })) continue;
      kiosk = await db.kiosk.create({ data: { pairCode: code, token: randomBytes(24).toString("base64url") } });
    }
    if (!kiosk) throw new Error("Couldn't make a pairing code");
    jar.set(KIOSK_COOKIE, kiosk.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 365 * 86_400 });
  }
  if (kiosk && Date.now() - kiosk.lastSeenAt.getTime() > 30_000) await db.kiosk.update({ where: { id: kiosk.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  return kiosk;
}

/** A paired kiosk, or null (API routes answer 401). */
export async function pairedKiosk() {
  const k = await kioskForThisDevice();
  return k?.pairedAt ? k : null;
}

/** Admin: pair the tablet showing this code. */
export async function pairKiosk(rawCode: string, name: string) {
  const code = normalizePairCode(rawCode);
  if (code.length !== PAIR_LENGTH) return null;
  const k = await db.kiosk.findUnique({ where: { pairCode: code } });
  if (!k) return null;
  return db.kiosk.update({ where: { id: k.id }, data: { pairedAt: new Date(), pairCode: null, name: name || "Kiosk" } });
}

export const listKiosks = () => db.kiosk.findMany({ where: { pairedAt: { not: null } }, orderBy: { pairedAt: "asc" }, include: { sales: { where: { status: "DONE" }, select: { totalCents: true, createdAt: true } } } });

export const unpairKiosk = (id: string) => db.kiosk.delete({ where: { id } });

/** "shop" (pay on your phone) or "order" (order requests only). */
export const setKioskMode = (id: string, mode: "shop" | "order") => db.kiosk.update({ where: { id }, data: { mode } });

// ── Sales ───────────────────────────────────────────────────────────────

export const kioskCartSchema = z.object({
  products: z.array(shopLineSchema).min(1, "The cart is empty.").max(20),
  codes: z.array(z.string().trim().min(1).max(60)).max(2).default([]),
});
export const kioskCustomerSchema = z.object({
  name: z.string().trim().min(1, "Add your name.").max(100),
  email: z.string().trim().toLowerCase().email("That email doesn't look right.").max(200),
  /** Order-mode kiosks: how to reach them, anything else, and the day they need it. */
  phone: z.string().trim().max(30).default(""),
  notes: z.string().trim().max(1000).default(""),
  needBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
});

const posCart = (c: z.infer<typeof kioskCartSchema>, email = ""): PosCartInput => ({ brand: "lightlab", products: c.products, codes: c.codes, email });

/** The cart's price, as the kiosk shows it. Order kiosks make things later, so stock doesn't limit them. */
export async function quoteKioskCart(cart: z.infer<typeof kioskCartSchema>, order = false) {
  return publicQuote(await pricePos(posCart(cart), { ignoreStock: order }));
}

export type KioskSaleView = { id: string; status: "PENDING" | "DONE" | "CANCELLED" | "PROBLEM"; url: string; totalCents: number; orderNumber: string | null; emailed: boolean };

const view = (s: { id: string; status: string; linkUrl: string; totalCents: number; orderNumber: string | null; email: string }): KioskSaleView => ({ id: s.id, status: s.status as KioskSaleView["status"], url: s.linkUrl, totalCents: s.totalCents, orderNumber: s.orderNumber, emailed: !!s.email && s.status === "DONE" });

/** Price the cart on the server and make the Square link to scan. Any older open sale on this kiosk is cancelled. */
export async function startKioskSale(kioskId: string, rawCart: z.input<typeof kioskCartSchema>, rawCustomer: z.input<typeof kioskCustomerSchema>) {
  const cart = kioskCartSchema.parse(rawCart);
  const customer = kioskCustomerSchema.parse(rawCustomer);
  const order = (await db.kiosk.findUnique({ where: { id: kioskId }, select: { mode: true } }))?.mode === "order";
  if (order) {
    if (customer.phone.replace(/\D/g, "").length < 7) throw new PosSaleError("Add your phone number.");
    if (!customer.needBy || customer.needBy < orderMinDate()) throw new PosSaleError("Pick a day at least a week away.");
  }
  if (!payLinksAvailable()) throw new PosSaleError("Card payments aren't set up right now. Please pay at the stand.");
  const priced = await pricePos(posCart(cart, customer.email), { ignoreStock: order });
  if (!priced.ok) throw new PosSaleError(priced.error ?? "Something in the cart can't be sold.", publicQuote(priced));
  if (priced.totalCents < 100) throw new PosSaleError("Totals under $1 can't be paid by card here. Please pay at the stand.");
  await cancelOpenSales(kioskId);
  const id = randomUUID();
  const link = await createPayLink(id, priced.totalCents, "lightlab");
  const sale = await db.kioskSale.create({
    data: { id, kioskId, cart: JSON.stringify(posCart(cart, customer.email)), totalCents: priced.totalCents, linkId: link.linkId, linkUrl: link.url, squareOrder: link.orderId, customerName: customer.name, email: customer.email, phone: customer.phone, notes: customer.notes, needBy: order ? customer.needBy : null },
  });
  return view(sale);
}

/** Paid yet? If Square says so, ring it up (once) like a register sale. */
export async function checkKioskSale(kioskId: string, id: string): Promise<KioskSaleView | null> {
  const sale = await db.kioskSale.findUnique({ where: { id } });
  if (!sale || sale.kioskId !== kioskId) return null;
  if (sale.status !== "PENDING") return view(sale);
  const status = await payLinkStatus(sale.squareOrder);
  if (!status.paid) return view(sale);
  try {
    const { order } = await ringUpSale({
      attemptId: sale.id,
      cart: JSON.parse(sale.cart) as PosCartInput,
      expectedTotalCents: sale.totalCents,
      payment: "CARD",
      squarePaymentId: status.paymentId,
      source: KIOSK_SOURCE,
      customer: { name: sale.customerName, email: sale.email, phone: sale.phone, notes: sale.notes },
      // Take-home sales are handed over; orders are made by the day they picked.
      handedOver: !sale.needBy,
      order: sale.needBy ? { needBy: sale.needBy } : null,
      kiosk: true,
      emailCustomer: !!sale.email,
    });
    return view(await db.kioskSale.update({ where: { id }, data: { status: "DONE", orderNumber: order.orderNumber } }));
  } catch (err) {
    // They've paid but the sale couldn't be saved (stock or price changed): the owner sorts it out.
    logError("kiosk:ring-up", err);
    const problem = err instanceof Error ? err.message : "Couldn't save the sale.";
    return view(await db.kioskSale.update({ where: { id }, data: { status: "PROBLEM", problem } }));
  }
}

/** The shopper went back or walked away: the link stops working. */
export async function cancelKioskSale(kioskId: string, id: string) {
  const sale = await db.kioskSale.findUnique({ where: { id } });
  if (!sale || sale.kioskId !== kioskId || sale.status !== "PENDING") return;
  // Paid in the last few seconds? Then ring it up instead of cancelling.
  const done = await checkKioskSale(kioskId, id).catch(() => null);
  if (done && done.status !== "PENDING") return;
  await db.kioskSale.update({ where: { id }, data: { status: "CANCELLED" } });
  await cancelPayLink(sale.linkId).catch((e) => logError("kiosk:cancel-link", e));
}

async function cancelOpenSales(kioskId: string) {
  const open = await db.kioskSale.findMany({ where: { kioskId, status: "PENDING" }, select: { id: true } });
  for (const s of open) await cancelKioskSale(kioskId, s.id);
}

/** Kiosk sales that were paid but couldn't be saved, for the admin. */
export const kioskProblems = () => db.kioskSale.findMany({ where: { status: "PROBLEM" }, orderBy: { createdAt: "desc" }, take: 20 });

/** A tablet that lost its connection mid-payment can't ring its sale up: the admin page catches those. */
export async function settleStaleKioskSales() {
  const now = Date.now();
  const stale = await db.kioskSale.findMany({ where: { status: "PENDING", createdAt: { lt: new Date(now - 60_000), gt: new Date(now - 86_400_000) } } });
  for (const s of stale) await checkKioskSale(s.kioskId, s.id).catch((e) => logError("kiosk:settle", e));
}
