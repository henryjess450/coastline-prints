import { describe, expect, it } from "vitest";
import { atStand, standFits, standLeft, type StandDto } from "@/lib/shop/stand";

const stand = (left: Record<string, number>): StandDto => ({ marketId: "m", name: "Moss Street", place: "Fairfield", date: "2026-11-14", startTime: "09:00", endTime: "13:00", when: "today", reservable: true, windows: [], left });

describe("at the stand", () => {
  it("reads an option packed on its own, else the product's shared count", () => {
    const s = stand({ "p1:red": 2, "p1:": 1 });
    expect(standLeft(s, "p1", "red")).toBe(2);
    expect(standLeft(s, "p1", "white")).toBe(1);
    expect(standLeft(s, "p2", null)).toBe(0);
    expect(atStand(s, "p1")).toBe(true);
    expect(atStand(s, "p2")).toBe(false);
  });

  it("fits a cart only when every line is at the stand with enough left (shared counts add up)", () => {
    const s = stand({ "p1:": 2, "p2:": 1 });
    expect(standFits(s, [{ productId: "p1", variantId: "a", quantity: 1 }, { productId: "p1", variantId: "b", quantity: 1 }])).toBe(true);
    expect(standFits(s, [{ productId: "p1", variantId: "a", quantity: 2 }, { productId: "p1", variantId: "b", quantity: 1 }])).toBe(false);
    expect(standFits(s, [{ productId: "p3", variantId: null, quantity: 1 }])).toBe(false);
    expect(standFits(s, [])).toBe(false);
  });
});
