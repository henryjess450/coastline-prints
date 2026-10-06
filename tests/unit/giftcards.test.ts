import { describe, expect, it } from "vitest";
import { deliverAtFor, friendlyDate, giftDetailsSchema, isValidSendOn, scheduleRange } from "@/lib/giftcards/rules";

describe("gift card scheduling", () => {
  it("sends at 9 am Pacific, in both daylight and standard time", () => {
    expect(deliverAtFor("2026-07-15").toISOString()).toBe("2026-07-15T16:00:00.000Z"); // PDT, UTC-7
    expect(deliverAtFor("2026-12-25").toISOString()).toBe("2026-12-25T17:00:00.000Z"); // PST, UTC-8
  });
  it("sends straight away when no date is chosen", () => {
    const now = new Date("2026-10-06T03:00:00Z");
    expect(deliverAtFor(null, now)).toBe(now);
  });
  it("only allows tomorrow up to a year ahead", () => {
    const now = new Date("2026-10-06T18:00:00Z"); // Oct 6, Pacific
    expect(scheduleRange(now)).toEqual({ min: "2026-10-07", max: "2027-10-06" });
    expect(isValidSendOn("2026-10-06", now)).toBe(false);
    expect(isValidSendOn("2026-10-07", now)).toBe(true);
    expect(isValidSendOn("2027-10-07", now)).toBe(false);
    expect(isValidSendOn(null, now)).toBe(true);
  });
  it("words the date plainly", () => {
    expect(friendlyDate("2026-10-12")).toBe("Monday, October 12");
  });
});

describe("gift card details", () => {
  const base = { amountCents: 5000, recipientName: "Jordan", recipientEmail: "Jordan@Example.com ", buyerName: "Sam", buyerEmail: "sam@example.com" };
  it("accepts a normal gift and tidies the emails", () => {
    const r = giftDetailsSchema.parse(base);
    expect(r.recipientEmail).toBe("jordan@example.com");
    expect(r.sendOn).toBeNull();
    expect(r.message).toBe("");
  });
  it("keeps amounts between $10 and $500", () => {
    expect(giftDetailsSchema.safeParse({ ...base, amountCents: 999 }).success).toBe(false);
    expect(giftDetailsSchema.safeParse({ ...base, amountCents: 50001 }).success).toBe(false);
    expect(giftDetailsSchema.safeParse({ ...base, amountCents: 1000 }).success).toBe(true);
  });
  it("limits the message length", () => {
    expect(giftDetailsSchema.safeParse({ ...base, message: "x".repeat(301) }).success).toBe(false);
  });
});
