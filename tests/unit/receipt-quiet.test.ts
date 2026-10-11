import { describe, expect, it } from "vitest";
import { quietUntil } from "@/lib/receipt/quiet";

const q = { from: 22, until: 7 };
const at = (iso: string) => quietUntil(new Date(iso), q, "America/Vancouver")?.toISOString() ?? null;

describe("receipt printer quiet hours", () => {
  it("prints straight away during the day and evening", () => {
    expect(at("2026-10-12T04:59:00Z")).toBeNull(); // 9:59 pm Pacific (PDT)
    expect(at("2026-10-12T14:00:00Z")).toBeNull(); // 7:00 am
    expect(at("2026-10-12T19:00:00Z")).toBeNull(); // noon
  });

  it("holds an 11 pm order until 7 am the next morning", () => {
    expect(at("2026-10-12T06:00:00Z")).toBe("2026-10-12T14:00:00.000Z"); // Oct 11, 11 pm → Oct 12, 7 am PDT
  });

  it("holds a 2:30 am order until 7 am the same morning", () => {
    expect(at("2026-10-12T09:30:00Z")).toBe("2026-10-12T14:00:00.000Z");
  });

  it("follows standard time in winter", () => {
    expect(at("2026-12-02T07:30:00Z")).toBe("2026-12-02T15:00:00.000Z"); // Dec 1, 11:30 pm PST → Dec 2, 7 am PST
  });
});
