import { describe, expect, it } from "vitest";
import { etransferDiscount, findPaymentCodes, parseInteracEmail, paymentCode } from "@/lib/payments/etransfer";

describe("payment codes", () => {
  it("look like PAY-XXXXX with no look-alike characters", () => {
    let i = 0;
    const code = paymentCode((n) => i++ % n);
    expect(code).toMatch(/^PAY-[2-9A-HJ-KMNP-Z]{5}$/);
  });

  it("are found however the customer typed them", () => {
    expect(findPaymentCodes("Order pay-7k4qx thanks!")).toEqual(["PAY-7K4QX"]);
    expect(findPaymentCodes("PAY 7K4QX")).toEqual(["PAY-7K4QX"]);
    expect(findPaymentCodes("PAY7K4QX.")).toEqual(["PAY-7K4QX"]);
    expect(findPaymentCodes("CP-2610-AB2C")).toEqual([]); // an order number isn't a payment code
    expect(findPaymentCodes("PAYMENT for prints")).toEqual([]);
  });
});

describe("e-Transfer discount", () => {
  it("is the percent of what's sent, rounded", () => {
    expect(etransferDiscount(2550, 2)).toBe(51);
    expect(etransferDiscount(0, 2)).toBe(0);
  });
});

describe("reading Interac emails", () => {
  it("reads an Autodeposit notification", () => {
    const text = `Hi Henry Jess,
SAM RIVERS sent you $24.51 (CAD) and the money has been automatically deposited into your bank account at Scotiabank.

Amount: $24.51 (CAD)
Sent From: SAM RIVERS
Message: PAY-7K4QX
Reference Number: CA1MRaBcD3fG`;
    expect(parseInteracEmail("INTERAC e-Transfer: SAM RIVERS sent you money.", text)).toEqual({
      amountCents: 2451,
      senderName: "SAM RIVERS",
      memo: "PAY-7K4QX",
      reference: "CA1MRaBcD3fG",
      deposited: true,
    });
  });

  it("handles thousands, no message, and money still waiting to be accepted", () => {
    const r = parseInteracEmail("INTERAC e-Transfer: A sent you money.", "A sent you $1,250.00 (CAD).\nAmount: $1,250.00\nMessage: (none)");
    expect(r).toMatchObject({ amountCents: 125000, memo: null, deposited: false });
  });

  it("ignores Interac emails that aren't money received", () => {
    expect(parseInteracEmail("INTERAC e-Transfer: Your transfer was cancelled", "The transfer of $10.00 was cancelled.")).toBeNull();
    expect(parseInteracEmail("Your statement", "Amount: $10.00")).toBeNull();
  });
});
