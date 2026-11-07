"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { logError } from "@/lib/api";
import { createCardBatch, retireCardBatch } from "@/lib/codes/thank-you";

const schema = z.object({
  count: z.number().int().min(1, "Make at least one card.").max(600, "Up to 600 cards at a time."),
  percent: z.number().int().min(1).max(50, "Up to 50% off."),
  days: z.number().int().min(1).max(3650).nullable(),
  heading: z.string().trim().min(1, "Add a heading.").max(60),
  message: z.string().trim().max(90),
});

export type CardActionState = { ok?: boolean; error?: string; id?: string; message?: string };

export async function createCardsAction(input: z.input<typeof schema>): Promise<CardActionState> {
  await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  try {
    const id = await createCardBatch(parsed.data);
    revalidatePath("/lightlab/admin/cards");
    return { ok: true, id };
  } catch (err) {
    logError("cards:create", err);
    return { error: "Couldn't make the cards." };
  }
}

export async function retireCardsAction(id: string): Promise<CardActionState> {
  await requireAdmin();
  if (!/^[0-9a-f]{8}$/.test(id)) return { error: "Unknown batch." };
  const n = await retireCardBatch(id);
  revalidatePath("/lightlab/admin/cards");
  return { ok: true, message: `Turned off ${n} unused ${n === 1 ? "card" : "cards"}.` };
}
