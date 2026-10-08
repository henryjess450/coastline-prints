import { describe, expect, it } from "vitest";
import { shipping } from "@config/shipping";
import { applyCodes, type CodeInfo } from "@/lib/codes/apply";
import { addressSchema } from "@/lib/checkout/schema";
import { pickRate } from "@/lib/shipping/canada-post";
import { quoteShipping, type ShippingQuote, type ShipPiece } from "@/lib/shipping/pack";

// Boxes only, unless a test turns the mailer back on.
const cfg = { ...shipping, paddingMm: 5, packingFeePerBoxCents: 200, mailer: { ...shipping.mailer, enabled: false } };
const withMailer = { ...cfg, mailer: { ...shipping.mailer, enabled: true, packingFeeCents: 200 } };
const piece = (x: number, y: number, z: number, grams = 50): ShipPiece => ({ sizeMm: { x, y, z }, grams });
const many = (n: number, p: ShipPiece) => Array.from({ length: n }, () => p);
/** The default option, flattened so tests read like before. */
const best = (q: ShippingQuote) => (q.ok ? { ok: true as const, ...q.options[0] } : q);

describe("flat rate box packing", () => {
  it("puts a small print in the Extra Small box and adds the packing fee", () => {
    const q = best(quoteShipping([piece(40, 40, 40)], cfg));
    // 5% GST on the postage only (not the packing fee).
    expect(q).toMatchObject({ ok: true, postageCents: 1899, taxCents: 95, taxLabel: "GST", packingCents: 200, totalCents: 1899 + 95 + 200 });
    expect(q.ok && q.boxes.map((b) => b.id)).toEqual(["xs"]);
  });

  it("turns the print to fit (orientation doesn't matter)", () => {
    // 60 tall but only 60 × 200 × 140 overall: fits Extra Small lying down.
    const q = best(quoteShipping([piece(60, 200, 140)], cfg));
    expect(q.ok && q.boxes[0].id).toBe("xs");
  });

  it("keeps padding around the print", () => {
    // 220 mm long fits the 225 mm box with no padding, but not with 5 mm each side.
    expect(best(quoteShipping([piece(220, 100, 50)], { ...cfg, paddingMm: 0 }))).toMatchObject({ ok: true, boxes: [{ id: "xs" }] });
    expect(best(quoteShipping([piece(220, 100, 50)], cfg))).toMatchObject({ ok: true, boxes: [{ id: "s" }] });
  });

  it("moves up a size when the prints won't all lie in a smaller box", () => {
    // 50 mm padded cubes: Extra Small holds a 4 × 3 layer and is too short for two layers.
    const twelve = best(quoteShipping(many(12, piece(40, 40, 40)), cfg));
    const thirteen = best(quoteShipping(many(13, piece(40, 40, 40)), cfg));
    expect(twelve).toMatchObject({ ok: true, boxes: [{ id: "xs", pieces: 12 }] });
    expect(thirteen).toMatchObject({ ok: true, boxes: [{ id: "s", pieces: 13 }] });
  });

  it("stacks layers when the box is tall enough", () => {
    // 50 mm padded cubes in Large (403 × 298 × 187): 8 × 5 per layer, 3 layers.
    const q = best(quoteShipping(many(120, piece(40, 40, 40, 10)), cfg));
    expect(q).toMatchObject({ ok: true, boxes: [{ id: "l", pieces: 120 }] });
    expect(best(quoteShipping(many(121, piece(40, 40, 40, 10)), cfg))).toMatchObject({ ok: true, boxes: [{ pieces: 120 }, { pieces: 1 }] });
  });

  it("uses more boxes when one Large isn't enough", () => {
    const q = best(quoteShipping(many(12, piece(150, 150, 150)), cfg));
    expect(q.ok && q.boxes.length).toBeGreaterThan(1);
    expect(q.ok && q.boxes.reduce((n, b) => n + b.pieces, 0)).toBe(12);
    expect(q.ok && q.packingCents).toBe((q.ok ? q.boxes.length : 0) * 200);
  });

  it("splits by weight at 5 kg per box", () => {
    const q = best(quoteShipping(many(3, piece(50, 50, 50, 2000)), cfg));
    expect(q.ok && q.boxes.length).toBe(2);
  });

  it("refuses prints too big or too heavy for any box", () => {
    expect(best(quoteShipping([piece(450, 100, 100)], cfg))).toMatchObject({ ok: false, reason: expect.stringMatching(/too big/) });
    expect(best(quoteShipping([piece(100, 100, 100, 4900)], cfg))).toMatchObject({ ok: false, reason: expect.stringMatching(/too heavy/) });
  });

  it("can be switched off", () => {
    expect(quoteShipping([piece(40, 40, 40)], { ...cfg, enabled: false }).ok).toBe(false);
  });
});

describe("bubble mailers", () => {
  it("offers a mailer first for a small flat order, with the tracked box as the upgrade", () => {
    const q = quoteShipping([piece(80, 60, 5, 40)], withMailer);
    expect(q.ok && q.options.map((o) => [o.method, o.tracked, o.totalCents])).toEqual([
      ["mailer", false, 261 + 13 + 200], // 65 g with the mailer, plus GST
      ["box", true, 1899 + 95 + 200],
    ]);
  });

  it("picks the Lettermail price by weight, mailer included", () => {
    const q = quoteShipping([piece(80, 60, 5, 380)], withMailer); // 405 g
    expect(q.ok && q.options[0]).toMatchObject({ method: "mailer", postageCents: 736 });
  });

  it("uses boxes only when it's too thick, too heavy or won't lie flat in one mailer", () => {
    const methods = (pieces: ShipPiece[]) => {
      const q = quoteShipping(pieces, withMailer);
      return q.ok ? q.options.map((o) => o.method) : null;
    };
    expect(methods([piece(80, 60, 6)])).toEqual(["mailer", "box"]); // 6 mm: still regular Lettermail
    expect(methods([piece(80, 60, 7)])).toEqual(["box"]); // thicker: would be irregular Lettermail
    expect(methods([piece(80, 60, 5, 490)])).toEqual(["box"]); // over 500 g with the mailer
    expect(methods([piece(340, 100, 5)])).toEqual(["box"]); // longer than the mailer
    expect(methods(many(4, piece(150, 100, 5)))).toEqual(["mailer", "box"]); // 2 × 2 fits 330 × 220
    expect(methods(many(5, piece(150, 100, 5)))).toEqual(["box"]); // no stacking in a mailer
  });
});

describe("bubble mailer as a parcel", () => {
  it("is possible for prints too thick for Lettermail, up to the parcel limit", () => {
    const q = quoteShipping([piece(120, 80, 30, 150)], withMailer);
    expect(q.ok && q.options.map((o) => o.method)).toEqual(["box"]);
    expect(q.ok && q.parcel).toEqual({ grams: 175, sizeMm: [360, 250, 36], pieces: 1 });
    const tooThick = quoteShipping([piece(120, 80, 60)], withMailer);
    expect(tooThick.ok && tooThick.parcel).toBeNull();
  });

  it("reads the price and tax of the chosen service from Canada Post's reply", () => {
    const xml = `<price-quotes>
      <price-quote><service-code>DOM.EP</service-code><price-details><taxes><gst>0.80</gst><pst>0</pst><hst>0</hst></taxes><due>16.80</due></price-details></price-quote>
      <price-quote><service-code>DOM.RP</service-code><price-details><taxes><gst>0.60</gst><pst>0.84</pst><hst>0</hst></taxes><due>13.44</due></price-details></price-quote>
    </price-quotes>`;
    expect(pickRate(xml, "DOM.RP")).toEqual({ baseCents: 1200, taxCents: 144, taxLabel: "GST + PST" });
    expect(pickRate(xml.replace(/<pst>0.84<\/pst>/, "<pst>0</pst>").replace("13.44", "12.60"), "DOM.RP")).toEqual({ baseCents: 1200, taxCents: 60, taxLabel: "GST" });
    expect(pickRate(xml, "DOM.XP")).toBeNull();
  });
});

describe("codes with shipping", () => {
  const pct = (percentOff: number): CodeInfo => ({ code: "PCT", kind: "PERCENT", percentOff, amountCents: null, balanceCents: null, minOrderCents: 0 });
  const amt = (amountCents: number): CodeInfo => ({ code: "AMT", kind: "AMOUNT", percentOff: null, amountCents, balanceCents: null, minOrderCents: 0 });
  const gc = (balanceCents: number): CodeInfo => ({ code: "1234567812345678", kind: "GIFT_CARD", percentOff: null, amountCents: null, balanceCents, minOrderCents: 0 });

  it("coupons come off the prints only", () => {
    expect(applyCodes(2000, [pct(50)], 2099).totalCents).toBe(1000 + 2099);
    expect(applyCodes(1000, [amt(5000)], 2099).totalCents).toBe(2099);
  });

  it("gift cards cover shipping too", () => {
    expect(applyCodes(1000, [gc(5000)], 2099)).toMatchObject({ totalCents: 0, giftCardCents: 3099 });
  });
});

describe("shipping address", () => {
  const base = { name: "Sam Rivers", line1: "1 Main Street", line2: "", city: "Halifax", province: "NS", postal: "b3h1a1" };

  it("tidies the postal code", () => {
    expect(addressSchema.parse(base).postal).toBe("B3H 1A1");
  });

  it("rejects non-Canadian addresses", () => {
    expect(addressSchema.safeParse({ ...base, postal: "90210" }).success).toBe(false);
    expect(addressSchema.safeParse({ ...base, province: "WA" }).success).toBe(false);
  });
});
