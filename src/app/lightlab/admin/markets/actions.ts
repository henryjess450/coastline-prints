"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { logError } from "@/lib/api";
import { db } from "@/lib/db";

export type MarketState = { ok?: boolean; error?: string; message?: string };

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Times look like 09:00.");
const marketSchema = z
  .object({
    id: z.string().max(40).nullable(),
    name: z.string().trim().min(1, "Give the market a name.").max(80),
    place: z.string().trim().min(1, "Say where it is.").max(120),
    address: z.string().trim().max(200).default(""),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
    startTime: time,
    endTime: time,
    note: z.string().trim().max(200).default(""),
    url: z
      .string()
      .trim()
      .max(300)
      .refine((u) => !u || /^https?:\/\/\S+$/.test(u), "Links start with https://")
      .default(""),
  })
  .refine((m) => m.endTime > m.startTime, { message: "It has to end after it starts." });

export type MarketInput = z.input<typeof marketSchema>;

function refresh() {
  revalidatePath("/lightlab");
  revalidatePath("/lightlab/admin/markets");
}

export async function saveMarketAction(input: MarketInput): Promise<MarketState> {
  await requireAdmin();
  const parsed = marketSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Some details aren't valid." };
  const { id, ...data } = parsed.data;
  try {
    if (id) await db.market.update({ where: { id }, data });
    else await db.market.create({ data });
    refresh();
    return { ok: true, message: id ? "Saved." : "Market added." };
  } catch (err) {
    logError("lightlab:market", err);
    return { error: "Couldn't save the market." };
  }
}

export async function deleteMarketAction(id: string): Promise<MarketState> {
  await requireAdmin();
  await db.market.deleteMany({ where: { id } });
  refresh();
  return { ok: true, message: "Market removed." };
}
