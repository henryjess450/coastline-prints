import "server-only";
import { randomBytes } from "node:crypto";
import type { PosRegister } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { createInvitedAccount } from "@/lib/account/auth";
import { sendNotificationsSoon } from "@/lib/notify/kick";
import { PAIR_ALPHABET, PAIR_LENGTH, normalizePairCode, orderDetailsError, type PosOrderDetails, type PosReply, type PosScreen } from "./types";

/** The customer display's cookie (its displayToken). */
export const DISPLAY_COOKIE = "cp_pos";
export const DISPLAY_COOKIE_DAYS = 365;

function pairCode() {
  const b = randomBytes(PAIR_LENGTH);
  return Array.from(b, (n) => PAIR_ALPHABET[n % PAIR_ALPHABET.length]).join("");
}

/** What a display (or the cashier) gets back on each poll. */
export function displayState(r: PosRegister) {
  return { paired: !!r.pairedAt, pairCode: r.pairedAt ? null : r.pairCode, screen: JSON.parse(r.screen) as PosScreen, version: r.version };
}

/** A new display, waiting to be paired. Old displays nobody paired are cleared out. */
export async function createDisplay() {
  await db.posRegister.deleteMany({ where: { pairedAt: null, createdAt: { lt: new Date(Date.now() - 86_400_000) } } });
  for (let i = 0; i < 5; i++) {
    const code = pairCode();
    if (await db.posRegister.findUnique({ where: { pairCode: code } })) continue;
    return db.posRegister.create({ data: { pairCode: code, displayToken: randomBytes(24).toString("base64url") } });
  }
  throw new Error("Couldn't make a pair code");
}

export async function displayByToken(token: string | undefined) {
  if (!token) return null;
  const r = await db.posRegister.findUnique({ where: { displayToken: token } });
  // Note it's alive, at most every 20 s, so the register can say when the display went quiet.
  if (r && Date.now() - r.lastSeenAt.getTime() > 20_000) await db.posRegister.update({ where: { id: r.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  return r;
}

/** The cashier typed the code shown on a display. */
export async function pairByCode(raw: string) {
  const code = normalizePairCode(raw);
  if (code.length !== PAIR_LENGTH) return null;
  const r = await db.posRegister.findUnique({ where: { pairCode: code } });
  if (!r) return null;
  return db.posRegister.update({ where: { id: r.id }, data: { pairCode: null, pairedAt: new Date(), screen: JSON.stringify({ stage: "idle" }), reply: null, version: { increment: 1 } } });
}

/** What the display should show now. A fresh sale clears the last customer's answer. */
export async function pushScreen(id: string, screen: PosScreen, opts: { clearReply?: boolean } = {}) {
  const { count } = await db.posRegister.updateMany({ where: { id, pairedAt: { not: null } }, data: { screen: JSON.stringify(screen), version: { increment: 1 }, ...(opts.clearReply ? { reply: null } : {}) } });
  return count > 0;
}

/** Joins Coastline Rewards at the register: a new account, emailed a sign-in link. False if they already had one. */
export async function joinRewards(email: string, name: string | null) {
  const customer = await createInvitedAccount(email, name?.trim() || null);
  if (!customer) return false;
  await db.outboxJob.create({ data: { kind: "email", template: "account-invite", payload: JSON.stringify({ orderId: "", customerId: customer.id, note: null }), dedupeKey: `invite:${customer.id}` } });
  sendNotificationsSoon("pos-account");
  return true;
}

/**
 * The customer answered the popup on the display: an email for the receipt,
 * joining Coastline Rewards (makes the account and emails them a sign-in
 * link; an existing account is just used), or closing it. Only for the popup
 * that's showing, so a stale tap can't answer a newer question.
 */
export async function replyFromDisplay(r: PosRegister, answer: { popupId: string; kind: PosReply["kind"]; email?: string; name?: string; order?: PosOrderDetails }) {
  const screen = JSON.parse(r.screen) as PosScreen;
  const popup = screen.popup;
  if (!popup || popup.id !== answer.popupId) return null;
  if (answer.kind === "email" && popup.kind !== "email") return null;
  if (answer.kind === "account" && popup.kind !== "account") return null;
  if (answer.kind === "order") {
    // Their order details: checked against the form that was showing.
    if (popup.kind !== "order" || !answer.order) return null;
    const problem = orderDetailsError(popup, answer.order);
    if (problem) throw new OrderFormError(problem);
    answer = { ...answer, email: answer.order.email, name: popup.firstName };
  }
  const email = answer.email?.trim().toLowerCase() || undefined;
  if (answer.kind !== "dismiss" && !email) return null;

  const created = answer.kind === "account" ? await joinRewards(email!, answer.name ?? null) : undefined;
  const reply: PosReply = { popupId: popup.id, kind: answer.kind, email, name: answer.name?.trim() || undefined, created, order: answer.kind === "order" ? answer.order : undefined, at: Date.now() };
  const next: PosScreen = { ...screen, popup: null, ...(email ? { email } : {}) };
  await db.posRegister.update({ where: { id: r.id }, data: { reply: JSON.stringify(reply), screen: JSON.stringify(next), version: { increment: 1 } } });
  return reply;
}

/** Something's missing on the order form; shown to the customer. */
export class OrderFormError extends Error {}
