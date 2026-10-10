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
import { changeOrderStatus, deleteOrder, setOrderArchived, StatusChangeError } from "@/lib/orders/admin";
import { confirmByOwner, EtransferConfirmError } from "@/lib/payments/etransfer.server";
import { rateLimit } from "@/lib/ratelimit";
import { saveSeason } from "@/lib/season";
import { generateCode, generatePin } from "@/lib/codes/server";
import { formatCardNumber, normalizeCode, type CodeKind } from "@/lib/codes/apply";
import { Prisma } from "@/generated/prisma/client";

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
    const r = await changeOrderStatus(orderId, status, {
      notify: form.get("notify") === "on",
      note: String(form.get("note") ?? ""),
      trackingNumber: String(form.get("trackingNumber") ?? ""),
    });
    if (r.notified) sendNotificationsSoon("status-change");
    revalidateOrders(orderId);
    return { ok: true, message: r.notified ? "Status updated. The customer is being emailed." : "Status updated." };
  } catch (err) {
    if (err instanceof StatusChangeError) return { error: err.message };
    logError("admin:status", err);
    return { error: "Couldn't update the status." };
  }
}

/** The one-tap "next step" button on order cards and the order page. */
export async function nextStepAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const orderId = String(form.get("orderId") ?? "");
  try {
    const r = await changeOrderStatus(orderId, String(form.get("to") ?? ""), { from: String(form.get("from") ?? ""), trackingNumber: String(form.get("trackingNumber") ?? "") });
    if (r.notified) sendNotificationsSoon("status-change");
    revalidateOrders(orderId);
    return { ok: true, message: r.notified ? "Done. The customer is being emailed." : "Done." };
  } catch (err) {
    if (err instanceof StatusChangeError) return { error: err.message };
    logError("admin:next-step", err);
    return { error: "That didn't save. Please try again." };
  }
}

function revalidateOrders(orderId: string) {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/queues");
}

export async function confirmEtransferAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const checkoutId = String(form.get("checkoutId") ?? "");
  const depositId = String(form.get("depositId") ?? "") || null;
  if (!checkoutId) return { error: "Choose the order it pays for." };
  try {
    const r = await confirmByOwner(checkoutId, depositId);
    revalidatePath("/admin/etransfers");
    revalidatePath("/admin");
    return { ok: true, message: r ? `Confirmed. Order ${r.order.orderNumber} is paid.` : "Confirmed." };
  } catch (err) {
    if (err instanceof EtransferConfirmError) return { error: err.message };
    logError("admin:etransfer", err);
    return { error: "Couldn't confirm it." };
  }
}

export async function ignoreDepositAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("depositId") ?? "");
  await db.etransferDeposit.updateMany({ where: { id, status: "REVIEW" }, data: { status: "IGNORED" } });
  revalidatePath("/admin/etransfers");
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

export async function printReceiptAction(form: FormData) {
  await requireAdmin();
  const orderId = String(form.get("orderId") ?? "");
  if (!(await db.order.findUnique({ where: { id: orderId }, select: { id: true } }))) return;
  await db.outboxJob.create({
    data: { kind: "print", template: "order-receipt", payload: JSON.stringify({ orderId }), dedupeKey: `${orderId}:print:${Date.now()}` },
  });
  sendNotificationsSoon("admin-print");
  revalidatePath(`/admin/orders/${orderId}`);
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

export type CodeActionState = ActionState & { created?: string };

export async function createCodeAction(_: CodeActionState, form: FormData): Promise<CodeActionState> {
  await requireAdmin();
  const kind = String(form.get("kind")) as CodeKind;
  if (!["PERCENT", "AMOUNT", "GIFT_CARD"].includes(kind)) return { error: "Pick a type." };
  const value = Number(form.get("value"));
  if (!Number.isFinite(value) || value <= 0) return { error: kind === "PERCENT" ? "Enter a percent between 1 and 100." : "Enter a dollar amount." };
  if (kind === "PERCENT" && (value > 100 || !Number.isInteger(value))) return { error: "Percent must be a whole number from 1 to 100." };
  const cents = Math.round(value * 100);
  if (kind !== "PERCENT" && cents > 100_000_00) return { error: "That amount is too large." };

  // Gift cards always get a random 16-digit number and PIN.
  const custom = kind === "GIFT_CARD" ? "" : normalizeCode(String(form.get("code") ?? ""));
  if (custom && !/^[A-Z0-9-]{4,30}$/.test(custom)) return { error: "Codes can use letters, numbers and dashes (4 to 30 characters)." };

  const maxUsesRaw = String(form.get("maxUses") ?? "").trim();
  const maxUses = maxUsesRaw ? Math.floor(Number(maxUsesRaw)) : null;
  if (maxUses != null && (!Number.isFinite(maxUses) || maxUses < 1)) return { error: "Max uses must be 1 or more (or blank for unlimited)." };
  const minOrder = Number(form.get("minOrder") || 0);
  const expires = String(form.get("expires") ?? "").trim();
  // Expires at the end of that day, shop time.
  const expiresAt = expires ? new Date(`${expires}T23:59:59-08:00`) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) return { error: "Invalid expiry date." };

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = custom || generateCode(kind);
    try {
      const created = await db.promoCode.create({
        data: {
          code,
          kind,
          pin: kind === "GIFT_CARD" ? generatePin() : null,
          percentOff: kind === "PERCENT" ? value : null,
          amountCents: kind === "AMOUNT" ? cents : null,
          initialCents: kind === "GIFT_CARD" ? cents : null,
          balanceCents: kind === "GIFT_CARD" ? cents : null,
          minOrderCents: kind === "GIFT_CARD" ? 0 : Math.max(0, Math.round(minOrder * 100)),
          maxUses: kind === "GIFT_CARD" ? null : maxUses,
          expiresAt,
          note: String(form.get("note") ?? "").trim().slice(0, 200) || null,
        },
      });
      if (form.get("print") === "on") await queueCodeSlip(created.id);
      revalidatePath("/admin/codes");
      const shown = kind === "GIFT_CARD" ? `${formatCardNumber(code)}  ·  PIN ${created.pin}` : formatCardNumber(code);
      return { ok: true, created: shown, message: `Created ${shown}` };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        if (custom) return { error: "That code already exists." };
        continue;
      }
      logError("admin:create-code", err);
      return { error: "Couldn't create the code." };
    }
  }
  return { error: "Couldn't create the code. Please try again." };
}

export async function toggleCodeAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const code = await db.promoCode.findUnique({ where: { id } });
  if (!code) return;
  await db.promoCode.update({ where: { id }, data: { active: !code.active } });
  revalidatePath("/admin/codes");
}

async function queueCodeSlip(codeId: string) {
  await db.outboxJob.create({
    data: { kind: "print", template: "code-slip", payload: JSON.stringify({ orderId: "", codeId }), dedupeKey: `code:${codeId}:print:${Date.now()}` },
  });
  sendNotificationsSoon("code-slip");
}

export async function printCodeAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (await db.promoCode.findUnique({ where: { id }, select: { id: true } })) await queueCodeSlip(id);
  revalidatePath("/admin/codes");
}

/** Switches the site's holiday theme (or back to blue). Every page picks it up straight away. */
export async function saveSeasonAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const season = await saveSeason(String(form.get("season") ?? ""));
    revalidatePath("/", "layout");
    return { ok: true, message: season.id === "coastline" ? "Back to Coastline blue." : `${season.name} is on across the site.` };
  } catch {
    return { error: "That theme didn't save. Please try again." };
  }
}

export async function archiveOrderAction(form: FormData) {
  await requireAdmin();
  const orderId = String(form.get("orderId") ?? "");
  await setOrderArchived(orderId, form.get("archive") === "1");
  revalidateOrders(orderId);
}

export async function deleteOrderAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await deleteOrder(String(form.get("orderId") ?? ""), String(form.get("confirm") ?? ""));
  } catch (err) {
    if (err instanceof StatusChangeError) return { error: err.message };
    logError("admin:delete-order", err);
    return { error: "That didn't delete. Please try again." };
  }
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  redirect("/admin/orders?view=list&status=ARCHIVED");
}
