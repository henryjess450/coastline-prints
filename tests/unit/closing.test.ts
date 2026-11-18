/** "We pack up at 3. Last chance today!": only in a market's last hour, on its day, in the shop's time zone. */
import { describe, expect, it } from "vitest";
import { closingIn, closingLine } from "@/lib/shop/closing";

// 2026-11-21 14:30 in Vancouver (PST, UTC-8).
const at = (hhmm: string) => new Date(`2026-11-21T${hhmm}:00-08:00`);
const market = [{ date: "2026-11-21", endTime: "15:00" }];

describe("closing time", () => {
  it("shows in the last hour, counting down", () => {
    expect(closingIn(market, at("14:30"))).toEqual({ minutes: 30, endTime: "15:00" });
    expect(closingIn(market, at("14:00"))).toEqual({ minutes: 60, endTime: "15:00" });
  });
  it("not before the last hour, after closing, or on another day", () => {
    expect(closingIn(market, at("13:59"))).toBeNull();
    expect(closingIn(market, at("15:00"))).toBeNull();
    expect(closingIn([{ date: "2026-11-22", endTime: "15:00" }], at("14:30"))).toBeNull();
    expect(closingIn([], at("14:30"))).toBeNull();
  });
  it("picks the market ending soonest", () => {
    expect(closingIn([...market, { date: "2026-11-21", endTime: "14:45" }], at("14:30"))?.endTime).toBe("14:45");
  });
  it("says it simply", () => {
    expect(closingLine("15:00")).toBe("We pack up at 3. Last chance today!");
    expect(closingLine("16:30")).toBe("We pack up at 4:30. Last chance today!");
  });
});
