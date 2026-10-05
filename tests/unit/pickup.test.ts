import { describe, expect, it } from "vitest";
import { pickup, type PickupConfig } from "@config/pickup";
import { addDays, availableDays, formatPickup, isValidPickup, slotsFor, todayIn } from "@/lib/pickup";

// Saturday Oct 3 2026, 11 pm in Vancouver = Sunday 06:00 UTC.
const lateSaturday = new Date("2026-10-04T06:00:00Z");

describe("pickup schedule", () => {
  it("uses the shop's time zone for 'today'", () => {
    expect(todayIn("America/Vancouver", lateSaturday)).toBe("2026-10-03");
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
  });

  it("weekday slots run 4 to 8 pm", () => {
    const slots = slotsFor("2026-10-07", pickup); // Wednesday
    expect(slots.map((s) => s.time)).toEqual(["16:00", "17:00", "18:00", "19:00"]);
    expect(slots[0].label).toBe("4 to 5 pm");
    expect(slots.at(-1)!.label).toBe("7 to 8 pm");
  });

  it("weekend slots run 9 am to 9 pm", () => {
    const slots = slotsFor("2026-10-10", pickup); // Saturday
    expect(slots).toHaveLength(12);
    expect(slots[0].label).toBe("9 to 10 am");
    expect(slots[2].label).toBe("11 am to 12 pm");
    expect(slots.at(-1)!.label).toBe("8 to 9 pm");
  });

  it("first bookable day is minLeadDays out", () => {
    const days = availableDays(pickup, lateSaturday);
    expect(days[0].date).toBe("2026-10-08"); // Oct 3 + 5
    expect(days.at(-1)!.date).toBe("2026-10-24"); // Oct 3 + 21
  });

  it("skips closed days and closed dates", () => {
    const cfg: PickupConfig = { ...pickup, hours: { ...pickup.hours, 2: null }, closedDates: ["2026-10-10"] };
    const dates = availableDays(cfg, lateSaturday).map((d) => d.date);
    expect(dates).not.toContain("2026-10-13"); // a Tuesday
    expect(dates).not.toContain("2026-10-10");
  });

  it("validates choices on the server", () => {
    expect(isValidPickup("2026-10-08", "16:00", pickup, lateSaturday)).toBe(true);
    expect(isValidPickup("2026-10-08", "10:00", pickup, lateSaturday)).toBe(false); // weekday morning
    expect(isValidPickup("2026-10-05", "16:00", pickup, lateSaturday)).toBe(false); // too soon
    expect(isValidPickup("2026-12-01", "16:00", pickup, lateSaturday)).toBe(false); // too far
    expect(isValidPickup("not-a-date", "16:00", pickup, lateSaturday)).toBe(false);
  });

  it("formats a booked time for emails and pages", () => {
    expect(formatPickup("2026-10-09", "17:00", pickup)).toBe("Friday, October 9, 5 to 6 pm");
    expect(formatPickup(null, null, pickup)).toBeNull();
  });
});
