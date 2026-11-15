import { describe, expect, it } from "vitest";
import { choiceIds, optionLabel, unitPrice, type ShopOptionSet, type ShopVariant } from "@/lib/shop/types";

const variants: ShopVariant[] = [{ id: "red", name: "Red cap", priceCents: null, stock: null, hex: null }];
const optionSets: ShopOptionSet[] = [
  { id: "cord", name: "Cord colour", choices: [{ id: "white", name: "White", extraCents: 0, hex: null }, { id: "gold", name: "Gold braid", extraCents: 500, hex: null }] },
  { id: "plug", name: "Plug", choices: [{ id: "wall", name: "Wall plug", extraCents: 0, hex: null }, { id: "usb", name: "USB", extraCents: 200, hex: null }] },
];
const p = { priceCents: 4500, variants, optionSets };

describe("product option sets", () => {
  it("picks the first choice of every set to start with", () => {
    expect(choiceIds(p)).toEqual(["white", "wall"]);
    expect(unitPrice(p, "red", choiceIds(p))).toBe(4500);
  });
  it("adds the extras of the picked choices", () => {
    expect(unitPrice(p, "red", ["usb", "gold"])).toBe(5200);
  });
  it("falls back to the first choice for a set left out or a choice since removed", () => {
    expect(choiceIds(p, ["gold", "gone"])).toEqual(["gold", "wall"]);
  });
  it("names what was chosen", () => {
    expect(optionLabel(p, "red", ["gold"])).toBe("Red cap · Cord colour: Gold braid · Plug: Wall plug");
    expect(optionLabel({ variants: [], optionSets: [] }, null)).toBeNull();
  });
});
