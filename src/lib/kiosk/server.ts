import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { SquareError } from "square";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { logError } from "@/lib/api";
import { cancelPayLink, createPayLink, payLinkStatus, payLinksAvailable } from "@/lib/pos/paylink.server";
import { pricePos, publicQuote } from "@/lib/pos/price.server";
import { PosSaleError, ringUpSale } from "@/lib/pos/sale.server";
import { PAIR_ALPHABET, PAIR_LENGTH, normalizePairCode, orderMinDate, type PosCartInput } from "@/lib/pos/types";
import { shopLineSchema } from "@/lib/shop/schema";
import { getSquare, squareLocationId } from "@/lib/square/client";
import { emailFromRef } from "@/lib/rewards/stand";
import { sendNotificationsSoon } from "@/lib/notify/kick";
import { friendlyPaymentError, GENERIC_PAYMENT_ERROR } from "@/lib/square/errors";

/*
 * The self-checkout kiosk at the LightLab stand. A tablet opens /kiosk, gets a
 * cookie and shows a pairing code; the owner types the code in LightLab admin
 * > Kiosk. From then on the tablet can price carts and start sales. The server
 * keeps each sale's cart and Square payment link, and rings the sale up (the
 * same way as the register) once Square says the shopper has paid: on their
 * phone by the QR link, or by typing their card into Square's card form on the
 * tablet. The tablet never decides what's paid.
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
  /** The customer chose to cover the card processing fee (asked when it's switched on). */
  coverFee: z.boolean().default(false),
});
export const kioskCustomerSchema = z.object({
  name: z.string().trim().min(1, "Add your name.").max(100),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email("That email doesn't look right.").max(200)]),
  /** Found with "Shopped with us before?": stands in for the email, which the tablet never sees in full. */
  rewardsRef: z.string().max(500).optional(),
  /** Order-mode kiosks: how to reach them, anything else, and the day they need it. */
  phone: z.string().trim().max(30).default(""),
  notes: z.string().trim().max(1000).default(""),
  needBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
});

// The kiosk is always paid by Square link: the card fee is added only when the customer chose to cover it.
const posCart = (c: z.infer<typeof kioskCartSchema>, email = ""): PosCartInput => ({ brand: "lightlab", products: c.products, codes: c.codes, email, cardFee: c.coverFee });

/** The cart's price, as the kiosk shows it. Order kiosks make things later, so stock doesn't limit them. */
export async function quoteKioskCart(cart: z.input<typeof kioskCartSchema>, order = false) {
  return publicQuote(await pricePos(posCart(kioskCartSchema.parse(cart)), { ignoreStock: order }));
}

export type KioskSaleView = { id: string; status: "PENDING" | "DONE" | "CANCELLED" | "PROBLEM"; url: string; totalCents: number; orderNumber: string | null; emailed: boolean };

// Only orders email on their own now; a take-home receipt is asked for afterwards.
const view = (s: { id: string; status: string; linkUrl: string; totalCents: number; orderNumber: string | null; email: string; needBy: string | null }): KioskSaleView => ({ id: s.id, status: s.status as KioskSaleView["status"], url: s.linkUrl, totalCents: s.totalCents, orderNumber: s.orderNumber, emailed: !!s.email && !!s.needBy && s.status === "DONE" });

/** Price the cart on the server and make the Square link to scan. Any older open sale on this kiosk is cancelled. */
export async function startKioskSale(kioskId: string, rawCart: z.input<typeof kioskCartSchema>, rawCustomer: z.input<typeof kioskCustomerSchema>) {
  const cart = kioskCartSchema.parse(rawCart);
  const customer = kioskCustomerSchema.parse(rawCustomer);
  if (!customer.email) customer.email = emailFromRef(customer.rewardsRef) ?? "";
  if (!customer.email) throw new PosSaleError("Add your email (for your receipt).");
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

/** Paid yet? If Square says so (by the QR, or a card typed on the tablet), ring it up (once) like a register sale. */
export async function checkKioskSale(kioskId: string, id: string): Promise<KioskSaleView | null> {
  const sale = await db.kioskSale.findUnique({ where: { id } });
  if (!sale || sale.kioskId !== kioskId) return null;
  if (sale.status !== "PENDING" || charging.has(id)) return view(sale);
  const status = await payLinkStatus(sale.squareOrder);
  if (status.paid) return ringUpKioskSale(sale, status.paymentId);
  const card = cardTried.has(id) ? await cardPaymentFor(sale) : null;
  return card ? ringUpKioskSale(sale, card) : view(sale);
}

/** Sales whose card is being charged right now: one charge at a time, and nothing cancels them mid-charge. */
const charging = new Set<string>();
/** Sales that have had a card charge tried on the tablet (it may have gone through even if the answer never arrived). */
const cardTried = new Set<string>();

/** A completed card payment Square already has for this sale (found by its reference), so a retry never charges twice. */
async function cardPaymentFor(sale: SaleRow): Promise<string | null> {
  const page = await getSquare().payments.list({ beginTime: new Date(sale.createdAt.getTime() - 60_000).toISOString(), locationId: squareLocationId(), limit: 100 });
  for await (const p of page) if (p.referenceId === sale.id.slice(0, 40) && p.status === "COMPLETED" && p.id) return p.id;
  return null;
}

type SaleRow = NonNullable<Awaited<ReturnType<typeof db.kioskSale.findUnique>>>;

/** Paid (by the link or by card): save it once, like a register sale. */
async function ringUpKioskSale(sale: SaleRow, paymentId: string): Promise<KioskSaleView> {
  const id = sale.id;
  // Another request may be saving this same sale right now: give it a few seconds, then use its order.
  for (let tries = 0; ; tries++) {
    try {
      return await ringUpOnce(sale, paymentId);
    } catch (err) {
      if (err instanceof PosSaleError && err.retry) {
        if (tries < 5) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        return view((await db.kioskSale.findUnique({ where: { id } })) ?? sale);
      }
      // They've paid but the sale couldn't be saved: the owner sorts it out. Never over a sale that did save.
      logError("kiosk:ring-up", err);
      const problem = `${err instanceof Error ? err.message : "Couldn't save the sale."} (Square payment ${paymentId})`;
      await db.kioskSale.updateMany({ where: { id, status: { in: ["PENDING", "CANCELLED"] } }, data: { status: "PROBLEM", problem } });
      return view((await db.kioskSale.findUnique({ where: { id } })) ?? sale);
    }
  }
}

async function ringUpOnce(sale: SaleRow, paymentId: string): Promise<KioskSaleView> {
  const id = sale.id;
  const { order } = await ringUpSale({
    attemptId: sale.id,
    cart: JSON.parse(sale.cart) as PosCartInput,
    expectedTotalCents: sale.totalCents,
    payment: "CARD",
    squarePaymentId: paymentId,
    source: KIOSK_SOURCE,
    customer: { name: sale.customerName, email: sale.email, phone: sale.phone, notes: sale.notes },
    // Take-home sales are handed over; orders are made by the day they picked.
    handedOver: !sale.needBy,
    order: sale.needBy ? { needBy: sale.needBy } : null,
    kiosk: true,
    // Take-home sales: no receipt unless they ask for one on the thank-you popup (orders always get their email).
    emailCustomer: false,
  });
  return view(await db.kioskSale.update({ where: { id }, data: { status: "DONE", orderNumber: order.orderNumber, problem: null } }));
}

/**
 * Paying on the tablet: charge the card Square's form tokenized, then ring the
 * sale up. The QR link is switched off once the card goes through so nobody
 * can pay twice; a decline leaves the link working.
 */
export async function payKioskSaleByCard(kioskId: string, id: string, sourceId: string): Promise<KioskSaleView> {
  if (charging.has(id)) throw new PosSaleError("Your payment is still going through. One moment.");
  charging.add(id);
  try {
    return await chargeCard(kioskId, id, sourceId);
  } finally {
    charging.delete(id);
  }
}

async function chargeCard(kioskId: string, id: string, sourceId: string): Promise<KioskSaleView> {
  const sale = await db.kioskSale.findUnique({ where: { id } });
  if (!sale || sale.kioskId !== kioskId) throw new PosSaleError("This payment has expired. Please start again.");
  if (sale.status !== "PENDING") return view(sale);
  // Already paid on a phone? Then that's the payment.
  const link = await payLinkStatus(sale.squareOrder);
  if (link.paid) return ringUpKioskSale(sale, link.paymentId);
  // An earlier try whose answer got lost on the way back may have charged the card already.
  if (cardTried.has(id)) {
    const earlier = await cardPaymentFor(sale);
    if (earlier) return ringUpKioskSale(sale, earlier);
  }
  cardTried.add(id);

  let paymentId: string;
  try {
    const { payment } = await getSquare().payments.create({
      sourceId,
      // The same card token can only ever charge once.
      idempotencyKey: `kc-${createHash("sha256").update(sourceId).digest("hex").slice(0, 40)}`,
      amountMoney: { amount: BigInt(sale.totalCents), currency: "CAD" },
      locationId: squareLocationId(),
      autocomplete: true,
      referenceId: sale.id.slice(0, 40),
      buyerEmailAddress: sale.email || undefined,
      note: `${KIOSK_SOURCE} card sale`,
    });
    if (!payment?.id || payment.status !== "COMPLETED") throw new PosSaleError(GENERIC_PAYMENT_ERROR);
    paymentId = payment.id;
  } catch (err) {
    if (err instanceof PosSaleError) throw err;
    if (err instanceof SquareError) {
      if (err.statusCode !== 402 && err.statusCode !== 400) logError("kiosk:card", err);
      throw new PosSaleError(friendlyPaymentError(err.errors.map((e) => String(e.code))));
    }
    logError("kiosk:card", err);
    throw new PosSaleError("We couldn't confirm your payment. Please try again; you won't be charged twice.");
  }

  // Close the QR. If they somehow paid there too in these few seconds, give the card back.
  await cancelPayLink(sale.linkId).catch((e) => logError("kiosk:card-close-link", e));
  const after = await payLinkStatus(sale.squareOrder).catch(() => ({ paid: false as const }));
  if (after.paid) {
    await getSquare()
      .refunds.refundPayment({ idempotencyKey: `kr-${paymentId}`.slice(0, 45), paymentId, amountMoney: { amount: BigInt(sale.totalCents), currency: "CAD" }, reason: "Paid twice at the kiosk" })
      .catch((e) => logError("kiosk:double-pay-refund", e));
    return ringUpKioskSale(sale, after.paymentId);
  }
  return ringUpKioskSale(sale, paymentId);
}

/** The shopper went back or walked away: the link stops working. */
export async function cancelKioskSale(kioskId: string, id: string) {
  const sale = await db.kioskSale.findUnique({ where: { id } });
  if (!sale || sale.kioskId !== kioskId || sale.status !== "PENDING" || charging.has(id)) return;
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

export const kioskReceiptSchema = z.object({ receipt: z.enum(["none", "print", "email"]).default("none"), gift: z.boolean().default(false) });

/**
 * The thank-you popup: a printed or emailed receipt and/or a gift receipt,
 * printed at the stand. Asking twice never prints twice.
 */
export async function sendKioskReceipts(kioskId: string, id: string, raw: z.input<typeof kioskReceiptSchema>) {
  const want = kioskReceiptSchema.parse(raw);
  const sale = await db.kioskSale.findUnique({ where: { id } });
  if (!sale || sale.kioskId !== kioskId || sale.status !== "DONE" || !sale.orderNumber) return { ok: false as const };
  const order = await db.order.findUnique({ where: { orderNumber: sale.orderNumber }, select: { id: true } });
  if (!order) return { ok: false as const };
  const orderId = order.id;
  const jobs: { kind: string; template: string; payload: string; dedupeKey: string }[] = [];
  const slip = (kind: "receipt" | "gift") => jobs.push({ kind: "print", template: "stand-slip", payload: JSON.stringify({ orderId, slip: kind, marketId: null }), dedupeKey: `${orderId}:stand-slip:${kind}` });
  if (want.receipt === "print") slip("receipt");
  if (want.receipt === "email" && sale.email && !sale.needBy) jobs.push({ kind: "email", template: "customer-receipt", payload: JSON.stringify({ orderId }), dedupeKey: `${orderId}:customer-receipt` });
  if (want.gift) slip("gift");
  for (const j of jobs) await db.outboxJob.upsert({ where: { dedupeKey: j.dedupeKey }, create: j, update: {} });
  if (jobs.length) sendNotificationsSoon("kiosk-receipt");
  return { ok: true as const };
}

/** Kiosk sales that were paid but couldn't be saved, for the admin. */
export const kioskProblems = () => db.kioskSale.findMany({ where: { status: "PROBLEM" }, orderBy: { createdAt: "desc" }, take: 20 });

/** A tablet that lost its connection mid-payment can't ring its sale up: the admin page catches those. */
export async function settleStaleKioskSales() {
  const now = Date.now();
  const stale = await db.kioskSale.findMany({ where: { status: "PENDING", createdAt: { lt: new Date(now - 60_000), gt: new Date(now - 86_400_000) } } });
  for (const s of stale) await checkKioskSale(s.kioskId, s.id).catch((e) => logError("kiosk:settle", e));
}
