import { z } from "zod";
import { seasons, type SeasonId } from "@config/seasons";

/**
 * Themes for the LightLab stand's printed receipts: a band for the market
 * the stand is at today, and decorations for the season. Edited on
 * Admin > Receipts and kept in the "printing" setting. Safe to import anywhere.
 */

/** Line drawings for a market's band (see art.ts). */
export const MARKET_ART = [
  { id: "harbour", name: "Harbour", hint: "Waves, a sailboat and a lighthouse" },
  { id: "city", name: "Old Town", hint: "A row of heritage storefronts" },
  { id: "garden", name: "Garden", hint: "Flowers and leaves, for farmers markets" },
  { id: "forest", name: "Forest", hint: "Mountains and pine trees" },
  { id: "lights", name: "Night market", hint: "A string of lights and the moon" },
  { id: "none", name: "No drawing", hint: "Just the market's name" },
] as const;
export type MarketArt = (typeof MARKET_ART)[number]["id"];

export const marketSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().trim().min(1, "Give the market a name.").max(40),
  /** Small line under the name, e.g. "Bastion Square · Saturdays". */
  place: z.string().trim().max(50).default(""),
  /** Printed near the bottom of the receipt. */
  message: z.string().trim().max(120).default(""),
  art: z.enum(MARKET_ART.map((a) => a.id) as [MarketArt, ...MarketArt[]]).default("harbour"),
});
export type Market = z.infer<typeof marketSchema>;

/** Which season decorates receipts: by the calendar, the site's theme, one picked by hand, or none ("coastline"). */
export type ReceiptSeasonMode = "auto" | "site" | SeasonId;

export const printSettingsSchema = z.object({
  /**
   * Where tickets go: "auto" uses the bridge while it's online and the
   * home network printer otherwise; "home" and "bridge" force one.
   */
  route: z.enum(["auto", "home", "bridge"]).default("auto"),
  season: z.string().default("auto"),
  /** Overrides for each season's printed greeting. */
  seasonMessages: z.record(z.string(), z.string().trim().max(120)).default({}),
  markets: z.array(marketSchema).max(30).default([]),
  /** Printed on every receipt when there's no market message. */
  footer: z.string().trim().max(120).default("Thanks for supporting a small Victoria maker!"),
});
export type PrintSettings = z.infer<typeof printSettingsSchema>;

/** Examples to start from; rename or delete them on Admin > Receipts. */
export const EXAMPLE_MARKETS: Market[] = [
  { id: "bastion-square", name: "Bastion Square Market", place: "Downtown Victoria", message: "See you next weekend in the square!", art: "city" },
  { id: "moss-street", name: "Moss Street Market", place: "Fairfield", message: "Thanks for shopping local at Moss Street!", art: "garden" },
  { id: "james-bay", name: "James Bay Market", place: "By the harbour", message: "Thanks for stopping by the stand!", art: "harbour" },
  { id: "holiday-market", name: "Holiday Market", place: "Victoria, B.C.", message: "Happy holidays from the LightLab stand!", art: "none" },
];

/** The greeting each season prints, unless the owner changed it. */
export const SEASON_MESSAGES: Record<SeasonId, string> = {
  coastline: "",
  christmas: "Merry Christmas and happy lighting!",
  newyear: "Here's to a bright new year!",
  valentines: "Made with love in Victoria.",
  stpatricks: "A little luck for your shelf.",
  easter: "Happy Easter from LightLab!",
  canadaday: "Happy Canada Day!",
  thanksgiving: "Thankful for you. Happy Thanksgiving!",
  halloween: "Happy Halloween! Keep a light on.",
  remembrance: "Lest we forget.",
  birthday: "It's our birthday! Thanks for being part of it.",
};

/** Easter Sunday (anonymous Gregorian algorithm) as [month, day]. */
function easter(year: number): [number, number] {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), gg = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - gg + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return [Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1];
}

/**
 * The season for a date by the calendar ("YYYY-MM-DD", shop time zone):
 * Christmas from mid-November, New Year's into the first week of January,
 * and the run-up to each other holiday. Plain the rest of the year.
 */
export function seasonForDate(ymd: string): SeasonId {
  const [y, mo, d] = ymd.split("-").map(Number);
  const md = mo * 100 + d;
  const [em, ed] = easter(y);
  const easterMd = em * 100 + ed;
  const daysBefore = (target: number, n: number) => {
    const t = Date.UTC(y, Math.floor(target / 100) - 1, target % 100);
    const now = Date.UTC(y, mo - 1, d);
    return now <= t && now >= t - n * 86_400_000;
  };
  if (md >= 1115 && md <= 1226) return "christmas";
  if (md >= 1227 || md <= 107) return "newyear";
  if (md >= 201 && md <= 214) return "valentines";
  if (md >= 310 && md <= 317) return "stpatricks";
  if (daysBefore(easterMd, 14) || md === easterMd + 1) return "easter";
  if (md >= 624 && md <= 701) return "canadaday";
  // Canadian Thanksgiving is the second Monday of October.
  const firstMon = ((8 - new Date(Date.UTC(y, 9, 1)).getUTCDay()) % 7) + 1;
  if (mo === 10 && d >= firstMon && d <= firstMon + 7) return "thanksgiving";
  if (md >= 1017 && md <= 1031) return "halloween";
  if (md >= 1101 && md <= 1111) return "remembrance";
  return "coastline";
}

/** Seasons the owner can pick for receipts. */
export const RECEIPT_SEASONS = seasons.map((s) => ({ id: s.id, name: s.id === "coastline" ? "Plain (no season)" : s.name }));
