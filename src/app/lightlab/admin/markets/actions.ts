"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { logError } from "@/lib/api";
import { db } from "@/lib/db";
import { printImage } from "@/lib/receipt/print";
import { renderPackingSlipPng } from "@/lib/receipt/packing-slip";
import { packingList, saveKit } from "@/lib/shop/packing.server";
import { setPacked } from "@/lib/shop/stand.server";

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

/** The stand kit on every packing list: one thing per line. */
export async function saveKitAction(text: string): Promise<MarketState> {
  await requireAdmin();
  await saveKit(text.split("\n"));
  revalidatePath("/lightlab/admin/markets", "layout");
  return { ok: true, message: "Kit list saved." };
}

/** Prints a market day's packing list on the receipt printer. */
export async function printPackingListAction(marketId: string): Promise<MarketState> {
  await requireAdmin();
  const list = await packingList(marketId);
  if (!list) return { error: "That market isn't there any more." };
  try {
    await printImage(await renderPackingSlipPng(list), `Packing list ${list.market.name}`);
    return { ok: true, message: "Sent to the printer." };
  } catch (err) {
    logError("lightlab:packing-print", err);
    return { error: err instanceof Error ? err.message : "Couldn't print it." };
  }
}

/** Packing list: a lamp went in the van (count) or came back out (0). It shows on the shop as at the stand. */
export async function setPackedAction(marketId: string, key: string, count: number): Promise<MarketState> {
  await requireAdmin();
  if (!/^[a-z0-9]{1,40}:[a-z0-9]{0,40}$/i.test(key) || !Number.isFinite(count)) return { error: "That line isn't valid." };
  await setPacked(marketId, key, Math.max(0, count));
  revalidatePath("/lightlab");
  return { ok: true };
}

/** At the stand: a hold was picked up, or let go so the lamp's back up for grabs. */
export async function setHoldStatusAction(id: string, status: "COLLECTED" | "RELEASED" | "HELD"): Promise<MarketState> {
  await requireAdmin();
  if (!["COLLECTED", "RELEASED", "HELD"].includes(status)) return { error: "Unknown status." };
  await db.standHold.update({ where: { id }, data: { status } });
  revalidatePath("/lightlab");
  return { ok: true };
}
