import "server-only";

/**
 * Model library search. Uses each site's official API where one exists
 * (an API key is required, see .env.example). Sites without a public API
 * (MakerWorld, Printables, Thangs) are offered as "search on" links instead
 * of being scraped.
 */

export type LibraryResult = {
  id: string;
  source: ProviderId;
  title: string;
  url: string;
  thumbnail: string | null;
  creator: string | null;
  license: string | null;
  /** null = unknown, 0 = free. */
  priceCents: number | null;
  priceCurrency: string | null;
};

export type ProviderId = "thingiverse" | "myminifactory" | "cults3d";

export type ProviderStatus = { id: ProviderId; name: string; ok: boolean; count: number; error?: string };

const TIMEOUT = 8000;
const UA = "CoastlinePrints/1.0 (+https://coastlineprints.ca)";

type Provider = {
  id: ProviderId;
  name: string;
  configured: () => boolean;
  search: (q: string) => Promise<LibraryResult[]>;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

const providers: Provider[] = [
  {
    id: "thingiverse",
    name: "Thingiverse",
    configured: () => !!process.env.THINGIVERSE_TOKEN,
    async search(q) {
      const url = `https://api.thingiverse.com/search/${encodeURIComponent(q)}/?type=things&per_page=24&page=1&sort=relevant`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.THINGIVERSE_TOKEN}`, "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { hits?: Record<string, unknown>[] };
      return (body.hits ?? []).map((h) => ({
        id: String(h.id),
        source: "thingiverse" as const,
        title: str(h.name) ?? "Untitled",
        url: str(h.public_url) ?? `https://www.thingiverse.com/thing:${h.id}`,
        thumbnail: str(h.preview_image) ?? str(h.thumbnail),
        creator: str((h.creator as Record<string, unknown> | undefined)?.name),
        license: str(h.license),
        priceCents: 0,
        priceCurrency: null,
      }));
    },
  },
  {
    id: "myminifactory",
    name: "MyMiniFactory",
    configured: () => !!process.env.MYMINIFACTORY_API_KEY,
    async search(q) {
      const url = `https://www.myminifactory.com/api/v2/search?q=${encodeURIComponent(q)}&per_page=24&page=1&key=${encodeURIComponent(process.env.MYMINIFACTORY_API_KEY!)}`;
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { items?: Record<string, unknown>[] };
      return (body.items ?? []).map((it) => {
        const designer = (it.designer ?? {}) as Record<string, unknown>;
        const images = (it.images ?? []) as { thumbnail?: { url?: string } }[];
        const licenses = it.licenses as { value?: unknown; label?: unknown }[] | undefined;
        return {
          id: String(it.id),
          source: "myminifactory" as const,
          title: str(it.name) ?? "Untitled",
          url: str(it.url) ?? `https://www.myminifactory.com/object/${it.id}`,
          thumbnail: str(images[0]?.thumbnail?.url),
          creator: str(designer.name) ?? str(designer.username),
          license: str(it.license) ?? (licenses?.[0] ? str(licenses[0].label) ?? str(licenses[0].value) : null),
          priceCents: null,
          priceCurrency: null,
        };
      });
    },
  },
  {
    id: "cults3d",
    name: "Cults3D",
    configured: () => !!(process.env.CULTS3D_USERNAME && process.env.CULTS3D_API_KEY),
    async search(q) {
      const query = `query($q: String!) { creationsSearchBatch(query: $q, limit: 24, offset: 0) { results {
        identifier name(locale: EN) url(locale: EN) illustrationImageUrl creator { nick } price(currency: USD) { cents } license { name(locale: EN) } } } }`;
      const auth = Buffer.from(`${process.env.CULTS3D_USERNAME}:${process.env.CULTS3D_API_KEY}`).toString("base64");
      const res = await fetch("https://cults3d.com/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}`, "User-Agent": UA },
        body: JSON.stringify({ query, variables: { q } }),
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { data?: { creationsSearchBatch?: { results?: Record<string, unknown>[] } }; errors?: { message: string }[] };
      if (body.errors?.length) throw new Error(body.errors[0].message);
      return (body.data?.creationsSearchBatch?.results ?? []).map((r) => {
        const cents = (r.price as { cents?: number } | null)?.cents;
        return {
          id: String(r.identifier),
          source: "cults3d" as const,
          title: str(r.name) ?? "Untitled",
          url: str(r.url) ?? "https://cults3d.com",
          thumbnail: str(r.illustrationImageUrl),
          creator: str((r.creator as { nick?: string } | null)?.nick),
          license: str((r.license as { name?: string } | null)?.name),
          priceCents: typeof cents === "number" ? cents : null,
          priceCurrency: "USD",
        };
      });
    },
  },
];

export function configuredProviders() {
  return providers.filter((p) => p.configured()).map((p) => ({ id: p.id, name: p.name }));
}

/** Links that open each site's own search for the same words. */
export function searchLinks(q: string) {
  const e = encodeURIComponent(q);
  return [
    { name: "MakerWorld", url: `https://makerworld.com/en/search/models?keyword=${e}` },
    { name: "Printables", url: `https://www.printables.com/search/models?q=${e}` },
    { name: "Thingiverse", url: `https://www.thingiverse.com/search?q=${e}&type=things` },
    { name: "Thangs", url: `https://thangs.com/search/${e}?scope=all` },
    { name: "Cults3D", url: `https://cults3d.com/en/search?q=${e}` },
    { name: "MyMiniFactory", url: `https://www.myminifactory.com/search/?query=${e}` },
  ];
}

const cache = new Map<string, { at: number; value: { results: LibraryResult[]; providers: ProviderStatus[] } }>();
const TTL = 10 * 60_000;

/** Searches every configured site in parallel and interleaves the results. */
export async function searchLibrary(raw: string) {
  const q = raw.trim().replace(/\s+/g, " ").slice(0, 80);
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  const active = providers.filter((p) => p.configured());
  const settled = await Promise.allSettled(active.map((p) => p.search(q)));
  const lists: LibraryResult[][] = [];
  const statuses: ProviderStatus[] = active.map((p, i) => {
    const r = settled[i];
    if (r.status === "fulfilled") {
      lists.push(r.value);
      return { id: p.id, name: p.name, ok: true, count: r.value.length };
    }
    console.error(`[library:${p.id}]`, r.reason);
    return { id: p.id, name: p.name, ok: false, count: 0, error: "Search failed" };
  });

  // Round-robin so one site doesn't fill the whole first screen.
  const results: LibraryResult[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (l[i]) results.push(l[i]);

  const value = { results, providers: statuses };
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
  return value;
}
