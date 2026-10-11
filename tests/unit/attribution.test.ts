import { describe, expect, it } from "vitest";
import { channelOf, sourceFields, tagged, touchFrom, touchesFromCookies } from "@/lib/attribution";

const at = (href: string, referrer = "") => touchFrom(new URL(href), referrer, 1);

describe("where a visit came from", () => {
  it("ignores visits from inside the site, or with no link at all", () => {
    expect(at("https://coastlineprints.ca/order", "https://coastlineprints.ca/")).toBeNull();
    expect(at("https://coastlineprints.ca/order", "https://www.coastlineprints.ca/")).toBeNull();
    expect(at("https://coastlineprints.ca/")).toBeNull();
    expect(channelOf(null)).toBe("Direct");
  });

  it("names the common channels", () => {
    expect(channelOf(at("https://coastlineprints.ca/", "https://www.google.ca/"))).toBe("Google search");
    expect(channelOf(at("https://coastlineprints.ca/?gclid=abc"))).toBe("Google Ads");
    expect(channelOf(at("https://coastlineprints.ca/?utm_source=instagram&utm_medium=bio"))).toBe("Instagram");
    expect(channelOf(at("https://coastlineprints.ca/", "https://l.instagram.com/"))).toBe("Instagram");
    expect(channelOf(at("https://coastlineprints.ca/?utm_source=facebook&utm_medium=cpc"))).toBe("Facebook ads");
    expect(channelOf(at("https://coastlineprints.ca/", "https://chatgpt.com/"))).toBe("AI assistants");
    expect(channelOf(at("https://coastlineprints.ca/", "https://www.perplexity.ai/search"))).toBe("AI assistants");
    expect(channelOf(at("https://coastlineprints.ca/?utm_source=coastline&utm_medium=email"))).toBe("Email");
    expect(channelOf(at("https://coastlineprints.ca/", "https://old.reddit.com/r/VictoriaBC"))).toBe("Reddit");
    expect(channelOf(at("https://coastlineprints.ca/?utm_source=flyer"))).toBe("Flyer");
    expect(channelOf(at("https://coastlineprints.ca/", "https://someblog.example/"))).toBe("Other websites");
  });

  it("reads the cookies back, and falls back to the latest visit for the first", () => {
    const last = encodeURIComponent(JSON.stringify({ s: "instagram", at: 2 }));
    const first = encodeURIComponent(JSON.stringify({ ref: "google.com", at: 1 }));
    expect(touchesFromCookies(`theme=dark; cp_src=${last}; cp_src1=${first}`)).toEqual({ last: { s: "instagram", at: 2 }, first: { ref: "google.com", at: 1 } });
    expect(sourceFields(`cp_src=${last}`)).toMatchObject({ source: "Instagram", firstSource: "Instagram" });
    expect(sourceFields(null)).toMatchObject({ source: "Direct", firstSource: "Direct" });
    expect(sourceFields("cp_src=not-json")).toMatchObject({ source: "Direct" });
  });

  it("tags our own links", () => {
    expect(tagged("https://coastlineprints.ca/order", "gift-card")).toBe("https://coastlineprints.ca/order?utm_source=coastline&utm_medium=email&utm_campaign=gift-card");
  });
});
