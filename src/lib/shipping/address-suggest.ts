import "server-only";
import { shipping } from "@config/shipping";
import { logError } from "@/lib/api";

/**
 * Address suggestions while typing, from Photon (photon.komoot.io, built on
 * OpenStreetMap; free, no key). Only what the customer typed is sent, from our
 * server, never their IP or anything else. Canada only.
 */
export type AddressSuggestion = { label: string; line1: string; city: string; province: string; postal: string };

const cache = new Map<string, { at: number; list: AddressSuggestion[] }>();
const CACHE_MS = 10 * 60_000;
const byName = new Map(shipping.provinces.map((p) => [p.name.toLowerCase(), p.code]));

type PhotonProps = { housenumber?: string; street?: string; name?: string; city?: string; town?: string; village?: string; district?: string; state?: string; postcode?: string; countrycode?: string };

export async function suggestAddresses(query: string): Promise<AddressSuggestion[]> {
  const q = query.trim().replace(/\s+/g, " ").slice(0, 120);
  if (q.length < 4) return [];
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.list;

  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en&bbox=-141,41.6,-52.6,83.1`;
    const res = await fetch(url, { headers: { "User-Agent": "CoastlinePrints/1.0 (coastline.printz@gmail.com)" }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`Photon ${res.status}`);
    const data = (await res.json()) as { features?: { properties: PhotonProps }[] };
    const seen = new Set<string>();
    const list: AddressSuggestion[] = [];
    for (const { properties: p } of data.features ?? []) {
      const province = byName.get((p.state ?? "").toLowerCase());
      const street = p.street ?? (p.housenumber ? p.name : undefined);
      const city = p.city ?? p.town ?? p.village ?? p.district;
      if (p.countrycode !== "CA" || !province || !street || !city) continue;
      const line1 = p.housenumber ? `${p.housenumber} ${street}` : street;
      const postal = (p.postcode ?? "").toUpperCase();
      const label = `${line1}, ${city} ${province}${postal ? ` ${postal}` : ""}`;
      if (seen.has(label)) continue;
      seen.add(label);
      list.push({ label, line1, city, province, postal: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/.test(postal) ? postal : "" });
      if (list.length === 5) break;
    }
    cache.set(key, { at: Date.now(), list });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return list;
  } catch (err) {
    logError("address-suggest", err);
    return [];
  }
}
