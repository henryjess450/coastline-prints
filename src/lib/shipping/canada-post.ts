import "server-only";
import { shipping } from "@config/shipping";
import { logError } from "@/lib/api";
import { parcelOption, type ParcelMailer, type ShippingOption } from "./pack";

/**
 * Live prices from Canada Post's Rating API (counter prices: what the post
 * office charges). Needs, in .env:
 *   CANADA_POST_USERNAME, CANADA_POST_PASSWORD  (developer API keys)
 *   CANADA_POST_FROM_POSTAL                     (where parcels are mailed from; never shown)
 *   CANADA_POST_ENV=development                 (optional: use the test gateway)
 */
export function canadaPostConfigured() {
  return !!(process.env.CANADA_POST_USERNAME && process.env.CANADA_POST_PASSWORD && process.env.CANADA_POST_FROM_POSTAL);
}

export type Rate = { baseCents: number; taxCents: number; taxLabel: string };

const cache = new Map<string, { rate: Rate | null; at: number }>();
const CACHE_MS = 60 * 60_000;

const postalKey = (p: string) => p.toUpperCase().replace(/[^A-Z0-9]/g, "");

async function requestRates(grams: number, sizeMm: [number, number, number], toPostal: string): Promise<string> {
  const [l, w, h] = sizeMm;
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<mailing-scenario xmlns="http://www.canadapost.ca/ws/ship/rate-v4">
  <quote-type>counter</quote-type>
  <parcel-characteristics>
    <weight>${(grams / 1000).toFixed(3)}</weight>
    <dimensions><length>${(l / 10).toFixed(1)}</length><width>${(w / 10).toFixed(1)}</width><height>${(h / 10).toFixed(1)}</height></dimensions>
  </parcel-characteristics>
  <origin-postal-code>${postalKey(process.env.CANADA_POST_FROM_POSTAL!)}</origin-postal-code>
  <destination><domestic><postal-code>${postalKey(toPostal)}</postal-code></domestic></destination>
</mailing-scenario>`;
  const host = process.env.CANADA_POST_ENV === "development" ? "ct.soa-gw.canadapost.ca" : "soa-gw.canadapost.ca";
  const type = "application/vnd.cpc.ship.rate-v4+xml";
  const res = await fetch(`https://${host}/rs/ship/price`, {
    method: "POST",
    headers: {
      Accept: type,
      "Content-Type": type,
      "Accept-language": "en-CA",
      Authorization: `Basic ${Buffer.from(`${process.env.CANADA_POST_USERNAME}:${process.env.CANADA_POST_PASSWORD}`).toString("base64")}`,
    },
    body,
    signal: AbortSignal.timeout(6000),
  });
  const xml = await res.text();
  if (!res.ok) throw new Error(`Canada Post rates ${res.status}: ${xml.slice(0, 300)}`);
  return xml;
}

/** The parcel price for the configured service, split into pre-tax and tax, or null when it can't be priced right now. */
export async function parcelRate(parcel: ParcelMailer, toPostal: string): Promise<Rate | null> {
  if (!canadaPostConfigured()) return null;
  const key = `${postalKey(toPostal)}:${parcel.grams}:${parcel.sizeMm.join("x")}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.rate;
  try {
    const rate = pickRate(await requestRates(parcel.grams, parcel.sizeMm, toPostal), shipping.mailer.parcel.service);
    cache.set(key, { rate, at: Date.now() });
    return rate;
  } catch (err) {
    logError("canada-post:rates", err);
    return null;
  }
}

/** One service's price from a price-quotes response: pre-tax (due minus taxes) and the taxes. */
export function pickRate(xml: string, service: string): Rate | null {
  for (const quote of xml.split("<price-quote>").slice(1)) {
    if (tag(quote, "service-code") !== service) continue;
    const due = Number(tag(quote, "due"));
    const [gst, pst, hst] = ["gst", "pst", "hst"].map((t) => Number(tag(quote, t)) || 0);
    if (!Number.isFinite(due) || due <= 0) return null;
    const taxCents = Math.round((gst + pst + hst) * 100);
    return { baseCents: Math.round(due * 100) - taxCents, taxCents, taxLabel: hst > 0 ? "HST" : pst > 0 ? "GST + PST" : "GST" };
  }
  return null;
}

function tag(xml: string, name: string) {
  return xml.match(new RegExp(`<${name}[^>]*>([^<]*)</${name}>`))?.[1]?.trim() ?? "";
}

/** The parcel-mailer option for this destination, or null if it can't be offered. */
export async function liveParcelOption(parcel: ParcelMailer | null, toPostal: string, cfg = shipping): Promise<ShippingOption | null> {
  if (!parcel) return null;
  const rate = await parcelRate(parcel, toPostal);
  return rate ? parcelOption(parcel, rate, { ...cfg, tax: { ...cfg.tax, label: rate.taxLabel } }) : null;
}

let taxCache: { tax: typeof shipping.tax; at: number } | null = null;
const TAX_MS = 12 * 60 * 60_000;
const TAX_RETRY_MS = 10 * 60_000;

/**
 * The tax Canada Post charges on postage from the shop, read live: price a
 * small reference parcel to the shop's own postal code (tax depends on where
 * it's mailed from) and divide its tax by its pre-tax price. Falls back to
 * config/shipping.ts when the keys aren't set or Canada Post can't be reached.
 */
export async function postageTax(): Promise<typeof shipping.tax> {
  if (!canadaPostConfigured()) return shipping.tax;
  if (taxCache && Date.now() - taxCache.at < TAX_MS) return taxCache.tax;
  try {
    const from = process.env.CANADA_POST_FROM_POSTAL!;
    const rate = pickRate(await requestRates(500, [200, 150, 50], from), shipping.mailer.parcel.service);
    if (!rate || rate.baseCents <= 0) throw new Error("No reference rate from Canada Post");
    // Rounded to the nearest half percent so cent rounding on the reference parcel can't skew it.
    const tax = { rate: Math.round((rate.taxCents / rate.baseCents) * 200) / 200, label: rate.taxLabel };
    taxCache = { tax, at: Date.now() };
    return tax;
  } catch (err) {
    logError("canada-post:tax", err);
    // Try again in a few minutes rather than on every request.
    taxCache = { tax: taxCache?.tax ?? shipping.tax, at: Date.now() - TAX_MS + TAX_RETRY_MS };
    return taxCache.tax;
  }
}
