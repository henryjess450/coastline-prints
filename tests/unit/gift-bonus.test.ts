import { describe, expect, it } from "vitest";
import { bonusFor, bonusLine, bonusLive } from "@/lib/giftcards/bonus";

const b = { on: true, name: "Holiday bonus", minCents: 5000, bonusCents: 500, startsOn: "2026-11-01", endsOn: "2026-12-24" };

describe("gift card bonus", () => {
  it("runs from the first day to the last, inclusive", () => {
    expect(bonusLive(b, "2026-10-31")).toBe(false);
    expect(bonusLive(b, "2026-11-01")).toBe(true);
    expect(bonusLive(b, "2026-12-24")).toBe(true);
    expect(bonusLive(b, "2026-12-25")).toBe(false);
    expect(bonusLive({ ...b, on: false }, "2026-12-01")).toBe(false);
  });

  it("only applies at or over the minimum", () => {
    expect(bonusFor(4999, b, "2026-12-01")).toBe(0);
    expect(bonusFor(5000, b, "2026-12-01")).toBe(500);
    expect(bonusFor(10000, b, "2026-10-01")).toBe(0);
  });

  it("reads plainly", () => {
    expect(bonusLine(b)).toBe("$5 extra on gift cards of $50 or more, until December 24");
  });
});
