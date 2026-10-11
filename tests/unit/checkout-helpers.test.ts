import { describe, expect, it } from "vitest";
import { customerSchema } from "@/lib/checkout/schema";
import { newOrderNumber, newViewToken, ORDER_NUMBER_RE } from "@/lib/orders/number";
import { friendlyPaymentError, GENERIC_PAYMENT_ERROR } from "@/lib/square/errors";

describe("order numbers", () => {
  it("formats as CP-YYMM-XXXX without confusable characters", () => {
    const n = newOrderNumber(new Date(2026, 9, 4));
    expect(n).toMatch(/^CP-2610-[2-9A-HJ-KMNP-Z]{4}$/);
  });
  it("uses LL- for LightLab orders, and either prefix is recognized", () => {
    expect(newOrderNumber(new Date(2026, 9, 4), "LL")).toMatch(/^LL-2610-[2-9A-HJ-KMNP-Z]{4}$/);
    expect(ORDER_NUMBER_RE.test("ll-2610-ab2c")).toBe(true);
    expect(ORDER_NUMBER_RE.test("CP-2610-AB2C")).toBe(true);
    expect(ORDER_NUMBER_RE.test("XX-2610-AB2C")).toBe(false);
  });
  it("view tokens are long and URL-safe", () => {
    expect(newViewToken()).toMatch(/^[\w-]{32}$/);
  });
});

describe("payment error messages", () => {
  it("maps known decline codes", () => {
    expect(friendlyPaymentError(["CVV_FAILURE"])).toMatch(/security code/);
    expect(friendlyPaymentError(["SOMETHING_ELSE", "INSUFFICIENT_FUNDS"])).toMatch(/enough funds/);
  });
  it("falls back to a safe generic message", () => {
    expect(friendlyPaymentError(["INTERNAL_SERVER_ERROR"])).toBe(GENERIC_PAYMENT_ERROR);
  });
});

describe("customer details", () => {
  const ok = { name: "Sam Rivers", email: "Sam@Example.com ", phone: "(604) 555-0123", pickupAcknowledged: true, termsAccepted: true };
  it("normalises email", () => {
    expect(customerSchema.parse(ok).email).toBe("sam@example.com");
  });
  it("requires the terms (pickup acknowledgement is checked only for pickup orders)", () => {
    expect(customerSchema.safeParse({ ...ok, termsAccepted: false }).success).toBe(false);
    expect(customerSchema.safeParse({ ...ok, pickupAcknowledged: false }).success).toBe(true);
  });
  it("rejects short phone numbers", () => {
    expect(customerSchema.safeParse({ ...ok, phone: "555-0123" }).success).toBe(false);
  });
});
