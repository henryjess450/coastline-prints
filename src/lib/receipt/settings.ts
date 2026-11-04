import "server-only";
import { pickup } from "@config/pickup";
import { seasons, type SeasonId } from "@config/seasons";
import { db } from "@/lib/db";
import { todayIn } from "@/lib/pickup";
import { getSeason } from "@/lib/season";
import { EXAMPLE_MARKETS, printSettingsSchema, SEASON_MESSAGES, seasonForDate, type Market, type PrintSettings } from "./themes";

const KEY = "printing";

export async function getPrintSettings(): Promise<PrintSettings> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  if (!row) return printSettingsSchema.parse({ markets: EXAMPLE_MARKETS });
  const parsed = printSettingsSchema.safeParse(JSON.parse(row.value));
  return parsed.success ? parsed.data : printSettingsSchema.parse({ markets: EXAMPLE_MARKETS });
}

export async function savePrintSettings(input: unknown) {
  const s = printSettingsSchema.parse(input);
  const ids = new Set(s.markets.map((m) => m.id));
  if (ids.size !== s.markets.length) throw new Error("Two markets have the same id.");
  const value = JSON.stringify(s);
  await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
  return s;
}

/** The season receipts are decorated for right now (or `override` from a preview). */
export async function receiptSeason(s: PrintSettings, override?: string | null): Promise<SeasonId> {
  const mode = override || s.season;
  if (mode === "site") return (await getSeason()).id;
  if (mode === "auto") return seasonForDate(todayIn(pickup.timeZone));
  return seasons.some((x) => x.id === mode) ? (mode as SeasonId) : "coastline";
}

export const seasonMessage = (s: PrintSettings, id: SeasonId) => s.seasonMessages[id] ?? SEASON_MESSAGES[id];

/** A market by id, or by the sale's source (the register sets the source to the market's name). */
export function findMarket(s: PrintSettings, idOrSource: string | null | undefined): Market | null {
  if (!idOrSource) return null;
  return s.markets.find((m) => m.id === idOrSource) ?? s.markets.find((m) => m.name.toLowerCase() === idOrSource.toLowerCase()) ?? null;
}
