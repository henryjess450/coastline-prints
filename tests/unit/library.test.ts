import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

function fakeFetch(routes: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) return new Response("nope", { status: 404 });
    return new Response(JSON.stringify(routes[key]), { status: 200, headers: { "Content-Type": "application/json" } });
  });
}

describe("model library", () => {
  it("parses each site and interleaves results", async () => {
    vi.stubEnv("THINGIVERSE_TOKEN", "t");
    vi.stubEnv("MYMINIFACTORY_API_KEY", "k");
    vi.stubEnv("CULTS3D_USERNAME", "u");
    vi.stubEnv("CULTS3D_API_KEY", "c");
    vi.stubGlobal(
      "fetch",
      fakeFetch({
        "api.thingiverse.com": { total: 2, hits: [{ id: 1, name: "Dragon A", public_url: "https://www.thingiverse.com/thing:1", thumbnail: "t1.jpg", creator: { name: "maker1" } }, { id: 2, name: "Dragon B" }] },
        "myminifactory.com": { items: [{ id: 9, name: "MMF Dragon", url: "https://www.myminifactory.com/object/9", images: [{ thumbnail: { url: "m.jpg" } }], designer: { username: "mm" }, license: "Download - Share" }] },
        "cults3d.com": { data: { creationsSearchBatch: { results: [{ identifier: "x", name: "Cults Dragon", url: "https://cults3d.com/x", illustrationImageUrl: "c.jpg", creator: { nick: "cn" }, price: { cents: 499 }, license: { name: "CC BY" } }] } } },
      }),
    );
    const { searchLibrary } = await import("@/lib/library/providers");
    const r = await searchLibrary("dragon");
    expect(r.providers.every((p) => p.ok)).toBe(true);
    expect(r.results.map((x) => x.title)).toEqual(["Dragon A", "MMF Dragon", "Cults Dragon", "Dragon B"]);
    expect(r.results[0]).toMatchObject({ source: "thingiverse", creator: "maker1", thumbnail: "t1.jpg", priceCents: 0 });
    expect(r.results[1]).toMatchObject({ creator: "mm", thumbnail: "m.jpg", license: "Download - Share" });
    expect(r.results[2]).toMatchObject({ priceCents: 499, priceCurrency: "USD", license: "CC BY" });
  });

  it("keeps working when one site fails", async () => {
    vi.stubEnv("THINGIVERSE_TOKEN", "t");
    vi.stubEnv("MYMINIFACTORY_API_KEY", "k");
    vi.stubGlobal("fetch", fakeFetch({ "myminifactory.com": { items: [{ id: 1, name: "Only MMF" }] } }));
    const { searchLibrary } = await import("@/lib/library/providers");
    const r = await searchLibrary("boat");
    expect(r.providers.find((p) => p.id === "thingiverse")?.ok).toBe(false);
    expect(r.results.map((x) => x.title)).toEqual(["Only MMF"]);
  });

  it("offers search links for sites without an API", async () => {
    const { searchLinks } = await import("@/lib/library/providers");
    const links = searchLinks("phone stand");
    expect(links.find((l) => l.name === "MakerWorld")?.url).toBe("https://makerworld.com/en/search/models?keyword=phone%20stand");
    expect(links.map((l) => l.name)).toContain("Printables");
  });
});
