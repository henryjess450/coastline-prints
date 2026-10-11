/**
 * Where orders come from. When someone arrives from outside the site (a
 * search, an ad, Instagram, an email link...), a small first-party cookie
 * remembers it: `cp_src` for the latest outside visit (30 days) and `cp_src1`
 * for the very first one (a year). Checkout reads them and saves the source
 * on the order. No personal details, nothing sent anywhere else.
 *
 * Tag your own links so they're counted properly, e.g.
 *   https://coastlineprints.ca/?utm_source=instagram&utm_medium=bio
 *   https://coastlineprints.ca/christmas-gifts?utm_source=flyer&utm_campaign=market
 */

export const LAST_COOKIE = "cp_src";
export const FIRST_COOKIE = "cp_src1";
export const LAST_DAYS = 30;
export const FIRST_DAYS = 365;

/** One arrival from outside the site. */
export type Touch = {
  /** utm_source, utm_medium, utm_campaign */
  s?: string;
  m?: string;
  c?: string;
  /** The other site's host, from the referrer. */
  ref?: string;
  /** Came from a Google Ads (gclid) or Meta ads (fbclid) click. */
  ad?: "google" | "meta";
  /** The page they landed on. */
  land?: string;
  /** When, in ms. */
  at: number;
};

const clean = (v: string | null, max = 60) => (v ? v.trim().toLowerCase().slice(0, max) || undefined : undefined);

/** The arrival this page load represents, or null if it's direct or from inside the site. */
export function touchFrom(url: URL, referrer: string, now = Date.now()): Touch | null {
  const p = url.searchParams;
  let ref: string | undefined;
  try {
    const host = referrer ? new URL(referrer).hostname.replace(/^www\./, "") : "";
    if (host && host !== url.hostname.replace(/^www\./, "")) ref = host.slice(0, 80);
  } catch {}
  const t: Touch = {
    s: clean(p.get("utm_source")),
    m: clean(p.get("utm_medium")),
    c: clean(p.get("utm_campaign")),
    ref,
    ad: p.get("gclid") || p.get("gbraid") || p.get("wbraid") ? "google" : p.get("fbclid") ? "meta" : undefined,
    land: url.pathname.slice(0, 80),
    at: now,
  };
  return t.s || t.ad || t.ref ? t : null;
}

const has = (host: string | undefined, ...names: string[]) => !!host && names.some((n) => host === n || host.endsWith(`.${n}`) || host.startsWith(`${n}.`));
const PAID = ["cpc", "ppc", "paid", "ads", "paidsocial", "paid_social", "display"];

/** A plain name for the channel, used to group orders in the admin. */
export function channelOf(t: Touch | null | undefined): string {
  if (!t) return "Direct";
  const s = t.s ?? "";
  const paid = !!t.m && PAID.includes(t.m);
  if (t.ad === "google" || (["google", "adwords"].includes(s) && paid)) return "Google Ads";
  if (t.ad === "meta" && !s) return "Facebook or Instagram";
  if (["instagram", "ig"].includes(s) || has(t.ref, "instagram.com")) return paid ? "Instagram ads" : "Instagram";
  if (["facebook", "fb", "meta"].includes(s) || has(t.ref, "facebook.com", "fb.com", "fb.me")) return paid ? "Facebook ads" : "Facebook";
  if (t.m === "email" || ["email", "newsletter"].includes(s)) return "Email";
  if (["chatgpt", "openai", "perplexity", "claude", "gemini", "copilot"].includes(s) || has(t.ref, "chatgpt.com", "chat.openai.com", "openai.com", "perplexity.ai", "claude.ai", "gemini.google.com", "copilot.microsoft.com")) return "AI assistants";
  if (has(t.ref, "reddit.com") || s === "reddit") return "Reddit";
  if (s === "google" || /(^|\.)google\.[a-z.]+$/.test(t.ref ?? "")) return "Google search";
  if (s === "bing" || has(t.ref, "bing.com")) return "Bing";
  if (has(t.ref, "duckduckgo.com")) return "DuckDuckGo";
  if (has(t.ref, "yahoo.com")) return "Yahoo";
  if (s) return s.charAt(0).toUpperCase() + s.slice(1);
  return "Other websites";
}

/** One line about a touch for the admin, like "instagram / bio · from l.instagram.com". */
export function touchDetail(t: Touch | null | undefined) {
  if (!t) return "No outside link (typed in, bookmark or app)";
  return [[t.s, t.m, t.c].filter(Boolean).join(" / "), t.ad === "google" ? "Google Ads click" : t.ad === "meta" ? "Meta ads click" : null, t.ref ? `from ${t.ref}` : null, t.land ? `landed on ${t.land}` : null].filter(Boolean).join(" · ");
}

function parse(v: string | undefined): Touch | null {
  if (!v) return null;
  try {
    const t = JSON.parse(decodeURIComponent(v)) as Touch;
    return t && typeof t.at === "number" ? t : null;
  } catch {
    return null;
  }
}

/** The latest and first outside visits from a request's Cookie header. */
export function touchesFromCookies(header: string | null): { last: Touch | null; first: Touch | null } {
  const jar = Object.fromEntries((header ?? "").split(/;\s*/).map((c) => [c.slice(0, c.indexOf("=")), c.slice(c.indexOf("=") + 1)]));
  return { last: parse(jar[LAST_COOKIE]), first: parse(jar[FIRST_COOKIE]) };
}

/** What gets saved on a checkout, order or gift purchase. */
export function sourceFields(header: string | null) {
  const { last, first } = touchesFromCookies(header);
  return { source: channelOf(last), firstSource: channelOf(first ?? last), sourceDetail: JSON.stringify({ last, first }) };
}

/** Adds utm tags to a link on this site, so clicks from our own emails count as Email. */
export function tagged(url: string, campaign: string, source = "coastline", medium = "email") {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", source);
    u.searchParams.set("utm_medium", medium);
    u.searchParams.set("utm_campaign", campaign);
    return u.toString();
  } catch {
    return url;
  }
}
