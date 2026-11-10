import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { lightlab } from "@config/lightlab";
import { logError } from "@/lib/api";
import { db } from "@/lib/db";
import { sendNotificationsSoon } from "@/lib/notify/kick";
import { finalizeCheckout, paymentFacts, type CartSnapshot } from "@/lib/orders/finalize";
import { etransferSettings, newPaymentCode } from "@/lib/payments/etransfer.server";
import { CARD_FEE_NAME, cardFeeFor } from "@/lib/pos/card-fee";
import { getCardFee } from "@/lib/pos/card-fee.server";
import { cancelPayLink, createPayLink, payLinksAvailable, payLinkStatus } from "@/lib/pos/paylink.server";
import { getSquare } from "@/lib/square/client";
import { getStorage } from "@/lib/storage";
import { appUrl } from "@/lib/email/data";
import type { LampCommission } from "@/generated/prisma/client";

/*
 * LightLab commissions ("Make me a lamp"): a customer sends an idea and
 * photos and picks a shade colour; the owner quotes a price; the customer
 * accepts and pays by e-Transfer (matched automatically like any checkout)
 * or by card (a Square link). Once paid it becomes a normal LightLab order.
 */

export const COMMISSION = {
  maxPhotos: 4,
  maxPhotoMb: 8,
  /** How long an accepted quote waits for an e-Transfer before the code lapses (a late one still goes to review). */
  payDays: 7,
} as const;

export type CommissionStatus = "NEW" | "QUOTED" | "ACCEPTED" | "PAID" | "DECLINED" | "CLOSED";

export const commissionRequestSchema = z.object({
  name: z.string().trim().min(2, "Please add your name.").max(100),
  email: z.string().trim().toLowerCase().email("Please check your email address.").max(200),
  phone: z.string().trim().max(30).default(""),
  idea: z.string().trim().min(15, "Tell us a bit more about the lamp you're picturing.").max(2000),
  shade: z.string().trim().max(80).default(""),
  shadeHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .default(null),
  neededBy: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/)
    .default(""),
});

/** What the file really is, from its first bytes. */
function sniff(b: Uint8Array) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

export class CommissionError extends Error {}

const email = (template: string, commissionId: string) => ({ kind: "email", template, payload: JSON.stringify({ orderId: "", commissionId }), dedupeKey: `${template}:${commissionId}:${Date.now()}` });

/** A new request: photos saved, the owner told, the customer gets a link to follow it. */
export async function createCommission(input: z.input<typeof commissionRequestSchema>, files: File[]) {
  const d = commissionRequestSchema.parse(input);
  if (files.length > COMMISSION.maxPhotos) throw new CommissionError(`Up to ${COMMISSION.maxPhotos} photos, please.`);
  const keys: string[] = [];
  for (const f of files) {
    if (f.size > COMMISSION.maxPhotoMb * 1024 * 1024) throw new CommissionError(`${f.name}: photos must be under ${COMMISSION.maxPhotoMb} MB.`);
    const data = new Uint8Array(await f.arrayBuffer());
    const ext = sniff(data);
    if (!ext) throw new CommissionError(`${f.name}: please use a JPG, PNG or WebP photo.`);
    const key = `commission/${randomBytes(12).toString("hex")}.${ext}`;
    await getStorage().put(key, data);
    keys.push(key);
  }
  const row = await db.lampCommission.create({
    data: { token: randomBytes(18).toString("base64url"), ...d, photos: JSON.stringify(keys) },
  });
  await db.outboxJob.createMany({ data: [email("commission-received", row.id), email("commission-new", row.id)] });
  sendNotificationsSoon("commission");
  return row;
}

/** Owner: send (or change) the quote. */
export async function quoteCommission(id: string, quoteCents: number, quoteNote: string) {
  const c = await db.lampCommission.findUnique({ where: { id } });
  if (!c) throw new CommissionError("That request was deleted.");
  if (c.status === "PAID") throw new CommissionError("It's already paid.");
  if (!Number.isInteger(quoteCents) || quoteCents < 100 || quoteCents > 500_000) throw new CommissionError("Quotes are between $1 and $5,000.");
  await dropPayment(c);
  await db.lampCommission.update({ where: { id }, data: { status: "QUOTED", quoteCents, quoteNote: quoteNote.trim().slice(0, 1000), quotedAt: new Date(), acceptedAt: null, checkoutId: null, cardCheckoutId: null, payLinkId: null, payLinkUrl: null, payLinkOrder: null } });
  await db.outboxJob.create({ data: email("commission-quote", id) });
  sendNotificationsSoon("commission");
}

/** Owner: close it (no quote, or it fell through). */
export async function closeCommission(id: string) {
  const c = await db.lampCommission.findUnique({ where: { id } });
  if (!c || c.status === "PAID") return;
  await dropPayment(c);
  await db.lampCommission.update({ where: { id }, data: { status: "CLOSED" } });
}

/** The customer's answer to the quote. Accepting gets the e-Transfer code ready. */
export async function answerQuote(token: string, accept: boolean) {
  const c = await db.lampCommission.findUnique({ where: { token } });
  if (!c || c.status !== "QUOTED" || c.quoteCents == null) throw new CommissionError("This quote can't be answered any more.");
  if (!accept) {
    await db.lampCommission.update({ where: { id: c.id }, data: { status: "DECLINED" } });
    await db.outboxJob.create({ data: email("commission-declined", c.id) });
    sendNotificationsSoon("commission");
    return;
  }
  await db.lampCommission.update({ where: { id: c.id }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
  await ensureEtransferCheckout(c.id);
  await db.outboxJob.create({ data: email("commission-accepted", c.id) });
  sendNotificationsSoon("commission");
}

/** The order line for the lamp. */
function lampLine(c: LampCommission) {
  const shade = c.shade ? ` (${c.shade} shade)` : "";
  const short = c.idea.replace(/\s+/g, " ").slice(0, 60);
  return { name: `LightLab commission${shade}: ${short}${c.idea.length > 60 ? "…" : ""}`, unitCents: c.quoteCents!, quantity: 1, lineCents: c.quoteCents! };
}

function snapshot(c: LampCommission, feeCents = 0): CartSnapshot {
  const lines = [lampLine(c), ...(feeCents ? [{ name: CARD_FEE_NAME, unitCents: feeCents, quantity: 1, lineCents: feeCents }] : [])];
  const total = lines.reduce((s, l) => s + l.lineCents, 0);
  return { lines: [], customLines: lines, shop: "lightlab", quote: { items: [], baseFeeCents: 0, subtotalCents: total, minimumAdjCents: 0, totalCents: total, shipping: null } };
}

const checkoutBase = (c: LampCommission) => ({
  customerName: c.name,
  customerEmail: c.email,
  customerPhone: c.phone || "Not given",
  notes: [`LightLab commission request (${c.id}).`, c.idea, c.neededBy ? `Hoping for it by ${c.neededBy}.` : ""].filter(Boolean).join("\n").slice(0, 1000),
  fulfillment: "PICKUP",
  source: "lightlab-commission",
});

/** The e-Transfer checkout for an accepted quote (remade if the last one lapsed). Null if e-Transfer isn't set up. */
export async function ensureEtransferCheckout(id: string) {
  const c = await db.lampCommission.findUnique({ where: { id } });
  if (!c || c.status !== "ACCEPTED" || c.quoteCents == null || !etransferSettings()) return null;
  const current = c.checkoutId ? await db.checkout.findUnique({ where: { id: c.checkoutId } }) : null;
  if (current && current.status !== "FAILED") return current;
  const co = await db.checkout.create({
    data: {
      idempotencyKey: randomUUID(),
      cart: JSON.stringify(snapshot(c)),
      totalCents: c.quoteCents,
      paymentMethod: "ETRANSFER",
      etransferCode: await newPaymentCode(),
      expiresAt: new Date(Date.now() + COMMISSION.payDays * 86_400_000),
      ...checkoutBase(c),
    },
  });
  await db.lampCommission.update({ where: { id: c.id }, data: { checkoutId: co.id } });
  // The usual "where to send it" email, with the code.
  await db.outboxJob.create({ data: { kind: "email", template: "etransfer-instructions", payload: JSON.stringify({ orderId: "", checkoutId: co.id }), dedupeKey: `${co.id}:etransfer-instructions` } });
  sendNotificationsSoon("etransfer-instructions");
  return co;
}

/** Paying by card: a Square link for the quote (plus the card fee if they chose to cover it). */
export async function commissionPayLink(token: string, coverFee: boolean) {
  const c = await db.lampCommission.findUnique({ where: { token } });
  if (!c || c.status !== "ACCEPTED" || c.quoteCents == null) throw new CommissionError("This can't be paid right now.");
  if (!payLinksAvailable()) throw new CommissionError("Card payments aren't set up right now. Please pay by e-Transfer.");
  const fee = await getCardFee();
  const feeCents = fee.on && coverFee ? cardFeeFor(c.quoteCents, fee) : 0;
  const total = c.quoteCents + feeCents;
  // Same answer as last time: the same link.
  if (c.payLinkUrl && c.cardCheckoutId) {
    const co = await db.checkout.findUnique({ where: { id: c.cardCheckoutId } });
    if (co?.status === "PENDING" && co.totalCents === total) return c.payLinkUrl;
  }
  await dropCard(c);
  const co = await db.checkout.create({ data: { idempotencyKey: randomUUID(), cart: JSON.stringify(snapshot(c, feeCents)), totalCents: total, paymentMethod: "CARD", ...checkoutBase(c) } });
  const link = await createPayLink(co.id, total, "lightlab", { name: "LightLab commission", note: `LightLab commission for ${c.name}`, redirectUrl: `${appUrl()}${commissionUrl(c.token)}` });
  await db.lampCommission.update({ where: { id: c.id }, data: { cardCheckoutId: co.id, payLinkId: link.linkId, payLinkUrl: link.url, payLinkOrder: link.orderId } });
  return link.url;
}

/** Brings a commission up to date: a paid e-Transfer or card link makes it PAID (with its order). */
export async function syncCommission(c: LampCommission): Promise<LampCommission> {
  if (c.status !== "ACCEPTED") return c;
  // Card: ask Square whether the link was paid, and ring it up once.
  if (c.payLinkOrder && c.cardCheckoutId) {
    try {
      const status = await payLinkStatus(c.payLinkOrder);
      if (status.paid) {
        const { payment } = await getSquare().payments.get({ paymentId: status.paymentId });
        // Same as an online order paid by card: receipt, owner email and the rest go out as usual.
        if (payment) {
          const r = await finalizeCheckout(c.cardCheckoutId, paymentFacts(payment));
          if (r?.created) sendNotificationsSoon("commission-paid");
        }
      }
    } catch (err) {
      logError("commission:card", err);
    }
  }
  const order = await db.order.findFirst({ where: { checkoutId: { in: [c.checkoutId, c.cardCheckoutId].filter((x): x is string => !!x) } } });
  if (!order) return c;
  const paid = await db.lampCommission.update({ where: { id: c.id }, data: { status: "PAID", orderId: order.id } });
  // The other way to pay is no longer needed.
  const other = order.checkoutId === c.checkoutId ? c.cardCheckoutId : c.checkoutId;
  if (other) await db.checkout.updateMany({ where: { id: other, status: "PENDING" }, data: { status: "FAILED", failureReason: "Commission paid another way" } });
  if (order.checkoutId === c.checkoutId && c.payLinkId) await cancelPayLink(c.payLinkId).catch(() => undefined);
  return paid;
}

/** A quote changed or the request closed: the old payment options stop working. */
async function dropPayment(c: LampCommission) {
  if (c.checkoutId) await db.checkout.updateMany({ where: { id: c.checkoutId, status: "PENDING" }, data: { status: "FAILED", failureReason: "Commission quote changed" } });
  await dropCard(c);
}

async function dropCard(c: LampCommission) {
  if (c.cardCheckoutId) await db.checkout.updateMany({ where: { id: c.cardCheckoutId, status: "PENDING" }, data: { status: "FAILED", failureReason: "Commission card link replaced" } });
  if (c.payLinkId) await cancelPayLink(c.payLinkId).catch(() => undefined);
}

export const commissionPhotos = (c: { photos: string }) => {
  try {
    return JSON.parse(c.photos) as string[];
  } catch {
    return [];
  }
};

export const commissionPhotoUrl = (key: string) => `/api/lightlab/admin/commission-photo/${encodeURIComponent(key.replace(/^commission\//, ""))}`;

/** The customer's page for a request. */
export const commissionUrl = (token: string) => `/lightlab/commission/${token}`;

export const shopName = lightlab.name;
