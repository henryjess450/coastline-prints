import "server-only";
import { DEFAULT_SEASON, seasonById, seasons, type Season, type SeasonId } from "@config/seasons";
import { db } from "@/lib/db";

const KEY = "season";
// Read on every page, so keep it for a few seconds; saving clears it.
let cached: { season: Season; at: number } | null = null;

/** The site theme the owner has switched on (blue unless they've picked a holiday). */
export async function getSeason(): Promise<Season> {
  if (cached && Date.now() - cached.at < 10_000) return cached.season;
  const row = await db.setting.findUnique({ where: { key: KEY } }).catch(() => null);
  let id: string = DEFAULT_SEASON;
  try {
    id = row ? (JSON.parse(row.value) as { id: string }).id : DEFAULT_SEASON;
  } catch {}
  const season = seasonById(id);
  cached = { season, at: Date.now() };
  return season;
}

export async function saveSeason(id: string): Promise<Season> {
  if (!seasons.some((s) => s.id === id)) throw new Error("Unknown theme");
  if (id === DEFAULT_SEASON) await db.setting.deleteMany({ where: { key: KEY } });
  else await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: JSON.stringify({ id }) }, update: { value: JSON.stringify({ id }) } });
  cached = null;
  return seasonById(id as SeasonId);
}
