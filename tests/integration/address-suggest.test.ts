/** Address suggestions while typing: Photon is faked, only Canadian results come back. */
import { afterEach, describe, expect, it, vi } from "vitest";

const { suggestAddresses } = await import("@/lib/shipping/address-suggest");
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const feature = (p: Record<string, string>) => ({ properties: p });

describe("address suggestions", () => {
  it("returns Canadian street addresses with province codes and postal codes", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        features: [
          feature({ housenumber: "350", street: "Sparks Street", city: "Ottawa", state: "Ontario", postcode: "K1R 7S8", countrycode: "CA" }),
          feature({ housenumber: "350", street: "Sparks Street", city: "Ottawa", state: "Ontario", postcode: "K1R 7S8", countrycode: "CA" }),
          feature({ housenumber: "350", street: "Sparks Street", city: "Seattle", state: "Washington", postcode: "98101", countrycode: "US" }),
          feature({ name: "Parliament Hill", city: "Ottawa", state: "Ontario", countrycode: "CA" }),
        ],
      }),
    );
    globalThis.fetch = fetch as never;
    expect(await suggestAddresses("350 sparks st")).toEqual([{ label: "350 Sparks Street, Ottawa ON K1R 7S8", line1: "350 Sparks Street", city: "Ottawa", province: "ON", postal: "K1R 7S8" }]);
    expect(String((fetch.mock.calls[0] as unknown[])[0])).toContain("q=350%20sparks%20st");
  });

  it("does nothing for short input and fails quietly", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("offline");
    }) as never;
    expect(await suggestAddresses("12")).toEqual([]);
    expect(await suggestAddresses("12 Nowhere Road")).toEqual([]);
  });
});
