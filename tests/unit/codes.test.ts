import { describe, expect, it } from "vitest";
import { applyCodes, maskCode, normalizeCode, type CodeInfo } from "@/lib/codes/apply";

const pct = (p: number, extra: Partial<CodeInfo> = {}): CodeInfo => ({ code: `P${p}`, kind: "PERCENT", percentOff: p, amountCents: null, balanceCents: null, minOrderCents: 0, ...extra });
const amt = (c: number, extra: Partial<CodeInfo> = {}): CodeInfo => ({ code: `A${c}`, kind: "AMOUNT", percentOff: null, amountCents: c, balanceCents: null, minOrderCents: 0, ...extra });
const gc = (bal: number, code = `GC-AAAA-BBBB-${bal}`): CodeInfo => ({ code, kind: "GIFT_CARD", percentOff: null, amountCents: null, balanceCents: bal, minOrderCents: 0 });

describe("applyCodes", () => {
  it("percent coupon rounds to the cent", () => {
    const r = applyCodes(1995, [pct(10)]);
    expect(r).toMatchObject({ discountCents: 200, totalCents: 1795 });
    expect(r.applied[0].label).toBe("Coupon P10 (10% off)");
  });

  it("dollar coupon never makes the total negative", () => {
    expect(applyCodes(800, [amt(1000)]).totalCents).toBe(0);
  });

  it("only one coupon per order", () => {
    const r = applyCodes(2000, [pct(10), amt(500)]);
    expect(r.discountCents).toBe(200);
    expect(r.rejected).toEqual([{ code: "A500", reason: "Only one coupon can be used per order." }]);
  });

  it("enforces the coupon minimum order", () => {
    const r = applyCodes(900, [amt(300, { minOrderCents: 1000 })]);
    expect(r.totalCents).toBe(900);
    expect(r.rejected[0].reason).toMatch(/at least \$10.00/);
  });

  it("applies the coupon first, then gift cards up to their balance", () => {
    const r = applyCodes(3000, [gc(1000), pct(50)]);
    expect(r.discountCents).toBe(1500);
    expect(r.giftCardCents).toBe(1000);
    expect(r.totalCents).toBe(500);
  });

  it("gift cards can cover the whole order and extra cards are refused", () => {
    const r = applyCodes(1200, [gc(1000, "GC-1"), gc(1000, "GC-2"), gc(1000, "GC-3")]);
    expect(r.applied.map((a) => a.amountCents)).toEqual([1000, 200]);
    expect(r.totalCents).toBe(0);
    expect(r.rejected).toEqual([{ code: "GC-3", reason: "Your order is already fully covered." }]);
  });

  it("refuses empty gift cards and more than three", () => {
    expect(applyCodes(1000, [gc(0)]).rejected[0].reason).toMatch(/no balance/);
    expect(applyCodes(9999, [gc(1, "a"), gc(1, "b"), gc(1, "c"), gc(1, "d")]).rejected.at(-1)?.reason).toMatch(/Up to 3/);
  });

  it("normalizes and masks codes", () => {
    expect(normalizeCode("  summer 10 ")).toBe("SUMMER10");
    expect(maskCode("GC-7QK2-M9PX-T4RB", "GIFT_CARD")).toBe("•••• T4RB");
    expect(maskCode("SUMMER10", "PERCENT")).toBe("SUMMER10");
  });
});

describe("gift card number and PIN", () => {
  it("accepts numbers with spaces or dashes and formats them in groups of 4", async () => {
    const { formatCardNumber, isCardNumber, normalizePin, codeEntry } = await import("@/lib/codes/apply");
    expect(isCardNumber("5268 9451-2705 3574")).toBe(true);
    expect(isCardNumber("SUMMER10")).toBe(false);
    expect(normalizeCode("5268 9451 2705 3574")).toBe("5268945127053574");
    expect(formatCardNumber("5268945127053574")).toBe("5268 9451 2705 3574");
    expect(normalizePin("cp 40247")).toBe("CP40247");
    expect(normalizePin("40247")).toBe("CP40247");
    expect(codeEntry({ code: "5268945127053574", pin: "CP40247", kind: "GIFT_CARD", percentOff: null, amountCents: null, balanceCents: 1, minOrderCents: 0 })).toBe("5268945127053574:CP40247");
    expect(maskCode("5268945127053574", "GIFT_CARD")).toBe("•••• 3574");
  });
});
