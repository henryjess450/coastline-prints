import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";

/*
 * The Wi-Fi networks the stand PC may join (STAND-PC.md). Kept here so they
 * can be changed from Admin > Receipts; the PC downloads the list with its
 * bridge key whenever it's online (/api/print-bridge/wifi). Top of the list
 * is tried first.
 */

const KEY = "stand-wifi";
export type StandWifi = { ssid: string; psk: string };

export const standWifiSchema = z
  .array(
    z.object({
      ssid: z.string().trim().min(1, "Every network needs a name.").refine((s) => Buffer.byteLength(s) <= 32, "Wi-Fi names are at most 32 characters."),
      psk: z.string().refine((p) => p === "" || (p.length >= 8 && p.length <= 63), "Wi-Fi passwords are 8 to 63 characters (or blank for an open network)."),
    }),
  )
  .max(30)
  .refine((list) => new Set(list.map((n) => n.ssid)).size === list.length, "The same network is in the list twice.");

export async function getStandWifi(): Promise<StandWifi[]> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  const parsed = standWifiSchema.safeParse(row ? JSON.parse(row.value) : []);
  return parsed.success ? parsed.data : [];
}

export async function saveStandWifi(list: StandWifi[]) {
  const value = JSON.stringify(standWifiSchema.parse(list));
  await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}

// When the stand PC last fetched the list (in memory: the site is one process).
const g = globalThis as unknown as { __standWifiFetched?: number };
export const standWifiFetched = () => (g.__standWifiFetched = Date.now());
export const standWifiFetchedAt = () => g.__standWifiFetched ?? null;
