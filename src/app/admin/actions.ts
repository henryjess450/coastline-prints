"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkCredentials, clearSessionCookie, requireAdmin, setSessionCookie } from "@/lib/admin/auth";
import { logError } from "@/lib/api";
import { resetSetting, saveMaterials, savePricing } from "@/lib/config/save";
import { db } from "@/lib/db";
import { sendNotificationsSoon } from "@/lib/notify/kick";
import { retryJob } from "@/lib/notify/outbox";
import { changeOrderStatus, StatusChangeError } from "@/lib/orders/admin";
import { rateLimit } from "@/lib/ratelimit";

export type ActionState = { ok?: boolean; error?: string; message?: string };

async function ip() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function loginAction(_: ActionState, form: FormData): Promise<ActionState> {
  const limit = rateLimit(`admin-login:${await ip()}`, 8, 15 * 60_000);
  if (!limit.ok) return { error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterS / 60)} minutes.` };
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  if (!checkCredentials(username, password)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return { error: "That username and password don't match." };
  }
  await setSessionCookie();
  redirect("/admin");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/admin/login");
}

export async function updateStatusAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const orderId = String(form.get("orderId") ?? "");
  const status = String(form.get("status") ?? "");
  try {
    const r = await changeOrderStatus(orderId, status, { notify: form.get("notify") === "on", note: String(form.get("note") ?? "") });
    if (r.notified) sendNotificationsSoon("status-change");
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin");
    revalidatePath("/admin/queues");
    return { ok: true, message: r.notified ? "Status updated. The customer is being emailed." : "Status updated." };
  } catch (err) {
    if (err instanceof StatusChangeError) return { error: err.message };
    logError("admin:status", err);
    return { error: "Couldn't update the status." };
  }
}

export async function retryJobAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("jobId") ?? "");
  const job = await db.outboxJob.findUnique({ where: { id } });
  if (!job) return;
  await retryJob(id);
  sendNotificationsSoon("admin-retry");
  revalidatePath("/admin");
  const orderId = (JSON.parse(job.payload) as { orderId?: string }).orderId;
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
}

export async function savePricingAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const dollars = (k: string) => Math.round(Number(form.get(k)) * 100);
  try {
    await savePricing({
      baseFeeCents: dollars("baseFee"),
      pricePerGramCents: Number(form.get("pricePerGramCents")),
      pricePerHourCents: dollars("pricePerHour"),
      markupPerPieceCents: dollars("markupPerPiece"),
      minimumOrderCents: dollars("minimumOrder"),
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Pricing saved. New quotes use it right away." };
  } catch {
    return { error: "Please check the numbers: they must be zero or more." };
  }
}

export async function saveMaterialsAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await saveMaterials(JSON.parse(String(form.get("materials") ?? "[]")));
    revalidatePath("/", "layout");
    return { ok: true, message: "Materials and colours saved." };
  } catch (err) {
    return { error: err instanceof Error && !err.message.startsWith("[") ? err.message : "Some colour details are invalid (name, 6-digit hex colour)." };
  }
}

export async function resetSettingAction(form: FormData) {
  await requireAdmin();
  const key = form.get("key");
  if (key === "pricing" || key === "materials") await resetSetting(key);
  revalidatePath("/", "layout");
}
