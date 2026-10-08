import "server-only";
import { randomInt } from "node:crypto";
import { render, toPlainText } from "@react-email/render";
import { etransfer as cfg } from "@config/payments";
import { pickup } from "@config/pickup";
import { privateSite } from "@config/private.server";
import { EtransferInstructions } from "@/emails/EtransferInstructions";
import { logError } from "@/lib/api";
import { releaseCodes } from "@/lib/codes/server";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email/data";
import type { OutgoingEmail } from "@/lib/email/transport";
import { sendNotificationsSoon } from "@/lib/notify/kick";
import { finalizeCheckout } from "@/lib/orders/finalize";
import { findPaymentCodes, parseInteracEmail, paymentCode, type EtransferPublic } from "./etransfer";

/**
 * Interac e-Transfer payments, matched from the deposit emails Interac sends
 * to the shop's inbox (read over IMAP). In .env:
 *   ETRANSFER_EMAIL            where customers send money (the Autodeposit address)
 *   ETRANSFER_IMAP_HOST/PORT   the mail server (Titan: imap.titan.email, 993)
 *   ETRANSFER_IMAP_USER        the mailbox the Interac emails land in
 *   ETRANSFER_IMAP_PASSWORD    its password
 */
export function etransferSettings() {
  const { ETRANSFER_EMAIL: email, ETRANSFER_IMAP_HOST: host, ETRANSFER_IMAP_USER: user, ETRANSFER_IMAP_PASSWORD: pass } = process.env;
  if (!cfg.enabled || !email || !host || !user || !pass) return null;
  return { email, host, port: Number(process.env.ETRANSFER_IMAP_PORT || 993), user, pass };
}

export function etransferPublic(): EtransferPublic {
  return etransferSettings() ? { discountPercent: cfg.discountPercent, payWindowMinutes: cfg.payWindowMinutes } : null;
}

/** A payment code no other checkout has. */
export async function newPaymentCode() {
  for (let i = 0; i < 10; i++) {
    const code = paymentCode(randomInt);
    if (!(await db.checkout.findUnique({ where: { etransferCode: code }, select: { id: true } }))) return code;
  }
  throw new Error("Couldn't make a unique payment code");
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const fmtTime = (d: Date) => d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", timeZone: pickup.timeZone });

/** The "how to pay" email for an e-Transfer checkout. */
export async function buildEtransferEmail(checkoutId: string): Promise<OutgoingEmail | null> {
  const co = await db.checkout.findUnique({ where: { id: checkoutId } });
  const s = etransferSettings();
  if (!co?.etransferCode || !s || co.status !== "PENDING") return null;
  const d = {
    customerName: co.customerName,
    amountCents: co.totalCents,
    code: co.etransferCode,
    sendTo: s.email,
    deadline: fmtTime(co.expiresAt ?? new Date()),
    waitUrl: `${appUrl()}/pay/${co.idempotencyKey}`,
  };
  const html = await render(<EtransferInstructions d={d} />);
  return { to: co.customerEmail, replyTo: privateSite.ownerEmail, subject: `Send ${(co.totalCents / 100).toFixed(2)} by e-Transfer to finish order ${co.etransferCode}`, html, text: toPlainText(html) };
}

/**
 * Marks an e-Transfer checkout paid and creates the order (once). Used by the
 * inbox matcher and by the owner's "Mark received" button.
 */
export async function confirmEtransfer(checkoutId: string, ref: string) {
  const co = await db.checkout.findUnique({ where: { id: checkoutId } });
  if (!co || co.paymentMethod !== "ETRANSFER") return null;
  const result = await finalizeCheckout(checkoutId, { id: `etr_${ref}`, status: "COMPLETED", amountCents: co.totalCents, currency: co.currency });
  if (result?.created) sendNotificationsSoon("etransfer");
  return result;
}

export class EtransferConfirmError extends Error {}

/**
 * The owner confirms an e-Transfer by hand (after checking the bank): a deposit
 * that needed review, or just "it arrived" for a waiting order.
 */
export async function confirmByOwner(checkoutId: string, depositId: string | null) {
  const co = await db.checkout.findUnique({ where: { id: checkoutId }, include: { order: true } });
  if (!co || co.paymentMethod !== "ETRANSFER") throw new EtransferConfirmError("That order isn't an e-Transfer order.");
  if (co.order) throw new EtransferConfirmError(`That's already paid (order ${co.order.orderNumber}).`);
  if (co.status === "FAILED") {
    if (co.appliedCodes !== "[]") throw new EtransferConfirmError("That order expired and its coupon or gift card hold was released. Ask the customer to order again (and refund the e-Transfer).");
    await db.checkout.update({ where: { id: co.id }, data: { status: "PENDING" } });
  }
  if (depositId) {
    const dep = await db.etransferDeposit.findUnique({ where: { id: depositId } });
    if (!dep || dep.status === "MATCHED") throw new EtransferConfirmError("That deposit is already used.");
    await db.etransferDeposit.update({ where: { id: depositId }, data: { status: "MATCHED", checkoutId: co.id, note: `${dep.note ?? ""} Confirmed by you.`.trim() } });
  }
  return confirmEtransfer(co.id, depositId ?? `manual_${co.id}`);
}

/** Cancels e-Transfer checkouts nobody paid in time and gives back held coupons and gift card balance. */
export async function expireEtransfers(now = new Date()) {
  const stale = await db.checkout.findMany({ where: { paymentMethod: "ETRANSFER", status: "PENDING", expiresAt: { lt: now } }, select: { id: true } });
  for (const { id } of stale) {
    const { count } = await db.checkout.updateMany({ where: { id, status: "PENDING" }, data: { status: "FAILED", failureReason: "e-Transfer not received in time" } });
    if (count) await releaseCodes(id);
  }
  return stale.length;
}

export type Incoming = { messageId: string; receivedAt: Date; subject: string; text: string; fromDomain: string; verified: boolean };

/**
 * Handles one Interac email: saves the deposit and pays the matching order.
 * Safe to call twice for the same email (the Message-ID is unique).
 */
export async function handleDepositEmail(mail: Incoming) {
  if (!cfg.interacDomains.some((d) => mail.fromDomain === d || mail.fromDomain.endsWith(`.${d}`))) return null;
  if (await db.etransferDeposit.findUnique({ where: { messageId: mail.messageId } })) return null;
  const parsed = parseInteracEmail(mail.subject, mail.text);
  if (!parsed) return null;

  const base = { messageId: mail.messageId, receivedAt: mail.receivedAt, amountCents: parsed.amountCents, senderName: parsed.senderName, memo: parsed.memo, reference: parsed.reference, verified: mail.verified };
  const review = (note: string) => db.etransferDeposit.create({ data: { ...base, status: "REVIEW", note } });

  if (!mail.verified) return review("Couldn't confirm this email really came from Interac. Check your bank before confirming.");
  if (!parsed.deposited) return review("This e-Transfer wasn't auto-deposited. Accept it in your bank, then confirm.");

  // Which order? The code in their message, or (if allowed) the one waiting order with this exact amount.
  const codes = findPaymentCodes(`${parsed.memo ?? ""}\n${mail.subject}\n${mail.text}`);
  let checkout = codes.length ? await db.checkout.findFirst({ where: { etransferCode: { in: codes } }, include: { order: true } }) : null;
  if (codes.length && !checkout) return review(`The message had ${codes.join(", ")}, which doesn't match any order.`);
  if (!checkout) {
    if (!cfg.autoMatchByAmount) return review("No payment code in the message.");
    const waiting = await db.checkout.findMany({ where: { paymentMethod: "ETRANSFER", status: "PENDING", totalCents: parsed.amountCents }, include: { order: true } });
    if (waiting.length !== 1) return review(waiting.length ? `No code, and ${waiting.length} waiting orders are for this amount.` : "No code, and no waiting order is for this amount.");
    checkout = waiting[0];
  }
  if (checkout.order) return review(`Order ${checkout.order.orderNumber} was already paid. This may be a second payment.`);
  if (parsed.amountCents < checkout.totalCents) return review(`Short: received ${money(parsed.amountCents)} for ${checkout.etransferCode} (${money(checkout.totalCents)}).`);

  if (checkout.status === "FAILED") {
    // Paid after the time ran out. Without coupons or gift cards nothing was given back, so it can go through.
    if (checkout.appliedCodes !== "[]") return review(`Arrived after ${checkout.etransferCode} expired, and its coupon or gift card hold was released.`);
    await db.checkout.update({ where: { id: checkout.id }, data: { status: "PENDING" } });
  }

  const deposit = await db.etransferDeposit.create({ data: { ...base, status: "MATCHED", checkoutId: checkout.id, note: parsed.amountCents > checkout.totalCents ? `Overpaid by ${money(parsed.amountCents - checkout.totalCents)}` : null } });
  await confirmEtransfer(checkout.id, deposit.id);
  return deposit;
}

let running: Promise<number> | null = null;
let lastRun = 0;

/**
 * Looks for new Interac emails (last 3 days) and handles them. Throttled, so
 * the waiting page can ask for a check without hammering the mail server.
 */
export function checkInbox(opts: { minGapMs?: number } = {}) {
  const s = etransferSettings();
  if (!s) return Promise.resolve(0);
  if (running) return running;
  if (Date.now() - lastRun < (opts.minGapMs ?? 15_000)) return Promise.resolve(0);
  lastRun = Date.now();
  running = readInbox(s)
    .catch((err) => {
      logError("etransfer:inbox", err);
      return 0;
    })
    .finally(() => {
      running = null;
    });
  return running;
}

async function readInbox(s: NonNullable<ReturnType<typeof etransferSettings>>) {
  let handled = 0;
  await scanInbox(s, async (mail) => {
    if (await handleDepositEmail(mail)) handled++;
  }, { skipKnown: true });
  return handled;
}

/**
 * Reads the Interac emails from the last few days, checks each one's DKIM
 * signature, and passes them on. Also used by scripts/etransfer-check.mts.
 */
export async function scanInbox(s: NonNullable<ReturnType<typeof etransferSettings>>, onMail: (mail: Incoming) => Promise<void>, opts: { days?: number; skipKnown?: boolean } = {}) {
  const [{ ImapFlow }, { simpleParser }, { dkimVerify }] = await Promise.all([import("imapflow"), import("mailparser"), import("mailauth")]);
  const client = new ImapFlow({ host: s.host, port: s.port, secure: s.port === 993, auth: { user: s.user, pass: s.pass }, logger: false, socketTimeout: 30_000 });
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = (await client.search({ since: new Date(Date.now() - (opts.days ?? 3) * 86_400_000), from: "interac" }, { uid: true })) || [];
      if (!uids.length) return;
      for await (const msg of client.fetch(uids, { envelope: true, source: true, internalDate: true }, { uid: true })) {
        const messageId = msg.envelope?.messageId ?? `uid-${msg.uid}`;
        if (!msg.source) continue;
        if (opts.skipKnown && (await db.etransferDeposit.findUnique({ where: { messageId }, select: { id: true } }))) continue;
        const mail = await simpleParser(msg.source);
        const from = mail.from?.value[0]?.address?.toLowerCase() ?? "";
        const dkim = await dkimVerify(msg.source).catch(() => null);
        const verified = !!dkim?.results?.some((r) => r.status?.result === "pass" && cfg.interacDomains.some((d) => r.signingDomain === d || r.signingDomain?.endsWith(`.${d}`)));
        const text = mail.text ?? (typeof mail.html === "string" ? mail.html.replace(/<[^>]+>/g, " ") : "");
        const internal = msg.internalDate instanceof Date ? msg.internalDate : msg.internalDate ? new Date(msg.internalDate) : undefined;
        await onMail({ messageId, receivedAt: mail.date ?? internal ?? new Date(), subject: mail.subject ?? "", text, fromDomain: from.split("@")[1] ?? "", verified });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

/** Is anyone waiting to pay right now? Then the inbox is checked every minute instead of every 10. */
export async function hasWaitingEtransfers() {
  return (await db.checkout.count({ where: { paymentMethod: "ETRANSFER", status: "PENDING" } })) > 0;
}
