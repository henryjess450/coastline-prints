"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/app/admin/actions";
import { createInvitedAccount } from "@/lib/account/auth";
import { requireAdmin } from "@/lib/admin/auth";
import { clearAnnouncementCache } from "@/lib/announcements";
import { logError } from "@/lib/api";
import { queueBroadcast } from "@/lib/broadcast";
import { db } from "@/lib/db";
import { sendNotificationsSoon } from "@/lib/notify/kick";

/*
 * Admin tools: customers (invite, points), announcements, site-wide sales and
 * emails to customers. Every action checks the admin session first.
 */

/** "2026-12-24" as the start (or end) of that day, shop time. */
function shopDay(date: string, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T${end ? "23:59:59" : "00:00:00"}-08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
const text = (form: FormData, k: string, max: number) => String(form.get(k) ?? "").trim().slice(0, max);
/** Links must be on this site ("/gift-cards") or https. */
function link(raw: string) {
  if (!raw) return null;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return /^https:\/\/[^\s]+$/.test(raw) ? raw : undefined;
}

export async function inviteCustomerAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const email = z.string().trim().toLowerCase().email().max(200).safeParse(form.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };
  try {
    const customer = await createInvitedAccount(email.data, text(form, "name", 120) || null);
    if (!customer) return { error: "That email already has an account." };
    await db.outboxJob.create({ data: { kind: "email", template: "account-invite", payload: JSON.stringify({ orderId: "", customerId: customer.id, note: text(form, "note", 500) || null }), dedupeKey: `invite:${customer.id}` } });
    sendNotificationsSoon("account-invite");
    revalidatePath("/admin/customers");
    return { ok: true, message: `Account made. ${email.data} is being emailed how to sign in.` };
  } catch (err) {
    logError("admin:invite", err);
    return { error: "That didn't work. Please try again." };
  }
}

/** Adds (or takes away) reward points by hand. */
export async function adjustPointsAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const points = Math.trunc(Number(form.get("points")));
  if (!email || !Number.isFinite(points) || points === 0 || Math.abs(points) > 100_000) return { error: "Enter a number of points, like 100 or -50." };
  const balance = (await db.pointsEntry.aggregate({ where: { email }, _sum: { points: true } }))._sum.points ?? 0;
  if (balance + points < 0) return { error: `They only have ${balance} points.` };
  await db.pointsEntry.create({ data: { email, points, kind: "ADJUST" } });
  revalidatePath(`/admin/customers/${encodeURIComponent(email)}`);
  return { ok: true, message: points > 0 ? `Added ${points} points.` : `Took away ${-points} points.` };
}

export async function createAnnouncementAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const message = text(form, "message", 240);
  if (message.length < 3) return { error: "Write the announcement." };
  const linkUrl = link(text(form, "linkUrl", 300));
  if (linkUrl === undefined) return { error: "Links need to start with / (a page on this site) or https://." };
  const startsAt = text(form, "startsAt", 10) ? shopDay(text(form, "startsAt", 10)) : null;
  const endsAt = text(form, "endsAt", 10) ? shopDay(text(form, "endsAt", 10), true) : null;
  if (startsAt === null && text(form, "startsAt", 10)) return { error: "Check the start date." };
  if (endsAt === null && text(form, "endsAt", 10)) return { error: "Check the end date." };
  if (startsAt && endsAt && endsAt <= startsAt) return { error: "The end date needs to be after the start." };
  await db.announcement.create({ data: { message, linkUrl, linkLabel: text(form, "linkLabel", 40) || null, startsAt, endsAt } });
  clearAnnouncementCache();
  revalidatePath("/", "layout");
  return { ok: true, message: startsAt && startsAt > new Date() ? "Saved. It'll show from the start date." : "It's showing across the site now." };
}

export async function endAnnouncementAction(form: FormData) {
  await requireAdmin();
  await db.announcement.updateMany({ where: { id: String(form.get("id") ?? "") }, data: { active: false } });
  clearAnnouncementCache();
  revalidatePath("/", "layout");
}

export async function createSaleAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = text(form, "name", 60);
  const percentOff = Math.trunc(Number(form.get("percentOff")));
  const startsAt = shopDay(text(form, "startsAt", 10));
  const endsAt = shopDay(text(form, "endsAt", 10), true);
  if (name.length < 2) return { error: "Give the sale a name, like Boxing Day." };
  if (!Number.isFinite(percentOff) || percentOff < 1 || percentOff > 90) return { error: "The discount needs to be 1 to 90 percent." };
  if (!startsAt || !endsAt) return { error: "Pick a start and end date." };
  if (endsAt <= startsAt) return { error: "The end date needs to be after the start." };
  await db.sale.create({ data: { name, percentOff, startsAt, endsAt } });
  revalidatePath("/admin/promote");
  return { ok: true, message: `${name}: ${percentOff}% off, saved.` };
}

export async function endSaleAction(form: FormData) {
  await requireAdmin();
  await db.sale.updateMany({ where: { id: String(form.get("id") ?? "") }, data: { active: false } });
  revalidatePath("/admin/promote");
}

/** Emails every customer who hasn't opted out. With `code`, it's a coupon campaign. */
export async function sendBroadcastAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const subject = text(form, "subject", 120);
  const body = text(form, "body", 4000);
  if (subject.length < 3 || body.length < 3) return { error: "Write a subject and a message." };
  const linkUrl = link(text(form, "linkUrl", 300));
  if (linkUrl === undefined) return { error: "Links need to start with / (a page on this site) or https://." };
  const codeId = text(form, "codeId", 40);
  let code: string | null = null;
  if (codeId) {
    const c = await db.promoCode.findUnique({ where: { id: codeId } });
    if (!c || !c.active || c.kind === "GIFT_CARD" || c.ownerId || c.referrerId) return { error: "That coupon can't be shared." };
    code = c.code;
  }
  if (form.get("confirm") !== "on") return { error: "Tick the box to confirm it's ready to send." };
  try {
    const { count } = await queueBroadcast({ subject, heading: text(form, "heading", 120) || subject, body, linkUrl: linkUrl ? (linkUrl.startsWith("/") ? `${process.env.APP_URL ?? ""}${linkUrl}` : linkUrl) : null, linkLabel: text(form, "linkLabel", 40) || null, code });
    sendNotificationsSoon("broadcast");
    revalidatePath("/admin/promote");
    return { ok: true, message: count ? `Sending to ${count} customer${count === 1 ? "" : "s"}.` : "No customers to send to yet." };
  } catch (err) {
    logError("admin:broadcast", err);
    return { error: "That didn't send. Please try again." };
  }
}
