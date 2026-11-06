import "server-only";
import { reviews, seo } from "@config/site";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email/data";
import { getPrintSettings } from "@/lib/receipt/settings";
import { dayParts, hours } from "@/lib/shop/markets";
import { shopToday, upcomingMarkets } from "@/lib/shop/markets.server";
import { getGiftBonus } from "@/lib/giftcards/bonus.server";
import { lightlab } from "@config/lightlab";
import { listProducts } from "@/lib/shop/products.server";
import { displaySettingsSchema, type DisplaySettings, type DisplaySlides } from "./types";

const KEY = "display-slides";

export async function getDisplaySettings(): Promise<DisplaySettings> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  const parsed = displaySettingsSchema.safeParse(row ? JSON.parse(row.value) : {});
  return parsed.success ? parsed.data : displaySettingsSchema.parse({});
}

export async function saveDisplaySettings(input: unknown) {
  const value = JSON.stringify(displaySettingsSchema.parse(input));
  await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}

/** What the LightLab customer display cycles through between sales. Links scanned from it are tagged as from the display. */
export async function loadDisplaySlides(override?: DisplaySettings): Promise<DisplaySlides> {
  const s = override ?? (await getDisplaySettings());
  const [all, markets, printing] = await Promise.all([listProducts({ shop: "lightlab" }), upcomingMarkets(6), getPrintSettings()]);
  const dollars = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
  const tag = (path: string) => `${appUrl()}${path}${path.includes("?") ? "&" : "?"}utm_source=market&utm_medium=display`;
  return {
    slides: s.slides,
    seconds: s.seconds,
    // The picked lamps, in the order they were picked.
    products: s.products
      .map((id) => all.find((p) => p.id === id))
      .filter((p) => !!p)
      .map((p) => {
        const prices = p.variants.length ? p.variants.map((v) => v.priceCents ?? p.priceCents) : [p.priceCents];
        const low = Math.min(...prices);
        return { name: p.name, tagline: p.tagline, price: new Set(prices).size > 1 ? `from ${dollars(low)}` : dollars(low), image: p.images[0] ?? null };
      }),
    markets: markets.map((m) => {
      const d = dayParts(m.date);
      return { name: m.name, month: d.month, day: d.day, weekday: d.weekday, long: d.long, hours: hours(m), place: m.place, address: m.address, note: m.note };
    }),
    links: { shop: tag("/lightlab"), gifts: tag("/gift-cards"), coastline: tag("/"), instagram: seo.instagram, review: reviews.googleUrl || null },
    comebackPercent: printing.comeback.on ? printing.comeback.percent : null,
    giftBonus: bonusLine(await getGiftBonus()),
    partnerLine: lightlab.partnerLine,
  };
}

/** The gift card bonus, the way the site's announcement bar says it, while it's on. */
function bonusLine(b: Awaited<ReturnType<typeof getGiftBonus>>) {
  const today = shopToday();
  if (!b.on || today < b.startsOn || today > b.endsOn) return null;
  const until = dayParts(b.endsOn);
  const dollars = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
  return `${b.name}: ${dollars(b.bonusCents)} extra on gift cards of ${dollars(b.minCents)} or more, until ${until.long.replace(/^\w+, /, "")}.`;
}
