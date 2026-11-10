"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { logError } from "@/lib/api";
import { closeCommission, CommissionError, quoteCommission } from "@/lib/commissions/server";

export type CommissionAdminState = { ok?: boolean; error?: string };

export async function quoteCommissionAction(id: string, dollars: string, note: string): Promise<CommissionAdminState> {
  await requireAdmin();
  const cents = Math.round(Number(dollars.replace(/[$,\s]/g, "")) * 100);
  if (!Number.isFinite(cents)) return { error: "Enter a price, like 85 or 85.50." };
  try {
    await quoteCommission(id, cents, note);
    revalidatePath("/lightlab/admin/commissions");
    return { ok: true };
  } catch (err) {
    if (err instanceof CommissionError) return { error: err.message };
    logError("commission:quote", err);
    return { error: "Couldn't send the quote." };
  }
}

export async function closeCommissionAction(id: string): Promise<CommissionAdminState> {
  await requireAdmin();
  await closeCommission(id);
  revalidatePath("/lightlab/admin/commissions");
  return { ok: true };
}
