import { describe, expect, it } from "vitest";
import { cashQuick, centsTyped, deckKeys, phoneShown, pickStep, type DeckProduct, type DeckState } from "@/lib/pos/deck";

const lamp = (i: number): DeckProduct => ({ id: `p${i}`, name: `Lamp ${i}`, priceCents: 4500, image: null, soldOut: false, inSale: 0, variants: [], optionSets: [], personalize: false });
const base: DeckState = {
  products: [1, 2, 3].map(lamp),
  itemCount: 0,
  totalCents: null,
  canPay: false,
  pay: null,
  saving: false,
  tenderedCents: null,
  linkPaid: false,
  done: null,
  panelOpen: false,
  customer: null,
  codes: 0,
  order: null,
  payLinks: true,
  etransfer: true,
  recent: [],
  lookup: { open: false, q: "", status: "idle", name: null },
  lock: { mode: "off", digits: 0, error: null },
  panel: null,
  custom: { cents: null, qty: 1, named: false },
  code: { code: "", pin: "", field: "code" },
  priceFocus: null,
  orderDraft: { qty: {}, named: false },
  sendTiles: [
    { id: "email", title: "Receipt", sub: "email" },
    { id: "shop", title: "Shop", sub: "QR code" },
  ],
  showing: null,
  staff: { on: false, step: "pin", digits: 0, error: null },
  feeAsk: false,
};
const ids = (s: DeckState, page: Parameters<typeof deckKeys>[1] = { name: "main" }) => deckKeys(s, page).map((k) => k.id);

describe("stand deck keys", () => {
  it("always has 15 keys", () => {
    expect(deckKeys(base, { name: "main" })).toHaveLength(15);
  });

  it("shows every item first, with Customer, Lock and Checkout along the bottom", () => {
    expect(ids(base).slice(0, 3)).toEqual(["product:p1", "product:p2", "product:p3"]);
    expect(ids(base).slice(12)).toEqual(["lookup", "lock", "checkout"]);
    const twelve = { ...base, products: Array.from({ length: 12 }, (_, i) => lamp(i)) };
    expect(ids(twelve)[11]).toBe("product:p11");
    const many = { ...base, products: Array.from({ length: 20 }, (_, i) => lamp(i)) };
    expect(ids(many).slice(0, 11)).toEqual(Array.from({ length: 11 }, (_, i) => `product:p${i}`));
    expect(ids(many)[11]).toBe("products:next");
    expect(ids(many, { name: "main", page: 1 }).slice(0, 9)).toEqual(Array.from({ length: 9 }, (_, i) => `product:p${i + 11}`));
    expect(ids(many, { name: "main", page: 1 })[9]).toBe("noop");
  });

  it("turns into a PIN pad while locked, with no way out but the PIN", () => {
    const locked = deckKeys({ ...base, itemCount: 2, done: { orderId: "a", orderNumber: "1", changeCents: null, offline: false }, lock: { mode: "locked", digits: 2, error: null } }, { name: "checkout" });
    expect(locked.slice(0, 10).map((k) => k.id)).toEqual(["pin:1", "pin:2", "pin:3", "pin:4", "pin:5", "pin:6", "pin:7", "pin:8", "pin:9", "pin:0"]);
    expect(locked[11].title).toBe("●●○○");
    expect(locked[14].id).toBe("noop");
    const picking = deckKeys({ ...base, lock: { mode: "set", digits: 0, error: null } }, { name: "main" });
    expect(picking[11].sub).toBe("New PIN");
    expect(picking[14].id).toBe("pin:cancel");
  });

  it("won't take payment or clear an empty sale", () => {
    const k = ids(base, { name: "checkout" });
    expect(k[11]).toBe("noop");
    expect(k[14]).toBe("noop");
    const ringing = ids({ ...base, itemCount: 1, totalCents: 4500, canPay: true }, { name: "checkout" });
    expect(ringing[11]).toBe("pay:CASH");
    expect(ringing[14]).toBe("clear");
    expect(ringing[0]).toBe("lookup");
    expect(ringing[10]).toBe("back");
  });

  it("shows cash amounts and change while taking cash", () => {
    expect(cashQuick(4500)).toEqual([4500, 5000, 6000, 10000]);
    const k = deckKeys({ ...base, itemCount: 1, totalCents: 4500, canPay: true, pay: "CASH", tenderedCents: 5000 }, { name: "main" });
    expect(k.slice(1, 5).map((x) => x.id)).toEqual(["tender:4500", "tender:5000", "tender:6000", "tender:10000"]);
    expect(k[2].tone).toBe("invert");
    expect(k[5].title).toBe("$5.00");
    expect(k[13].id).toBe("finish");
  });

  it("won't finish with too little cash", () => {
    const k = deckKeys({ ...base, itemCount: 1, totalCents: 4500, canPay: true, pay: "CASH", tenderedCents: 2000 }, { name: "main" });
    expect(k[13].id).toBe("noop");
  });

  it("reprints the picked sale's slips", () => {
    const recent = [
      { orderId: "a", orderNumber: "1001", totalCents: 4500, at: "" },
      { orderId: "b", orderNumber: "1000", totalCents: 2000, at: "" },
    ];
    expect(ids({ ...base, recent }, { name: "reprint", orderId: null }).slice(5, 8)).toEqual(["slip:a:receipt", "slip:a:gift", "slip:a:claim"]);
    expect(ids({ ...base, recent }, { name: "reprint", orderId: "b" })[5]).toBe("slip:b:receipt");
  });

  it("offers receipts and a new sale once it's done, but not for offline sales", () => {
    const done = { orderId: "a", orderNumber: "1001", changeCents: 500, offline: false };
    expect(ids({ ...base, done })[10]).toBe("slip:a:receipt");
    expect(ids({ ...base, done })[14]).toBe("new");
    expect(ids({ ...base, done: { ...done, offline: true } })[10]).toBe("noop");
  });

  it("turns into a number pad for a customer lookup", () => {
    const pad = (q: string, status: DeckState["lookup"]["status"] = "idle") => deckKeys({ ...base, panel: "customer", panelOpen: true, lookup: { open: true, q, status, name: "Sam" } }, { name: "main" });
    expect(pad("").slice(0, 10).map((k) => k.id)).toEqual(["digit:1", "digit:2", "digit:3", "digit:4", "digit:5", "digit:6", "digit:7", "digit:8", "digit:9", "digit:0"]);
    expect(pad("25")[13].id).toBe("noop");
    expect(pad("250")[13].id).toBe("find");
    expect(pad("2505550101")[11].title).toBe("250 555 0101");
    expect(pad("2505550101", "found")[11].title).toBe("Sam");
    expect(pad("2505550101", "found")[13].id).toBe("close");
    // The popup was closed on the screen: back to the page it was opened from.
    expect(ids(base, { name: "checkout" })[0]).toBe("lookup");
    expect(ids(base)[13]).toBe("lock");
  });

  it("formats phone numbers", () => {
    expect(phoneShown("250")).toBe("250");
    expect(phoneShown("25055")).toBe("250 55");
    expect(phoneShown("2505550101")).toBe("250 555 0101");
  });

  it("shows a lamp's colours, then its option lists, as swatches", () => {
    const fungi: DeckProduct = {
      ...lamp(1),
      variants: [
        { id: "red", name: "Red", hex: "#c00", cents: 4500, soldOut: false },
        { id: "blue", name: "Blue", hex: "#00c", cents: 5000, soldOut: true },
      ],
      optionSets: [{ id: "cord", name: "Cord colour", choices: [{ id: "black", name: "Black", hex: "#000", cents: 0, soldOut: false }, { id: "white", name: "White", hex: "#fff", cents: 300, soldOut: false }] }],
    };
    const s = { ...base, products: [fungi] };
    const first = deckKeys(s, { name: "options", pick: { productId: "p1", variantId: null, choices: [] }, back: { name: "main" } });
    expect(first[0]).toMatchObject({ id: "choose:red", swatch: "#c00", sub: "$45.00" });
    expect(first[1].id).toBe("noop"); // sold out
    expect(first[13].title).toBe("Colour");
    const second = deckKeys(s, { name: "options", pick: { productId: "p1", variantId: "red", choices: [] }, back: { name: "main" } });
    expect(second[1]).toMatchObject({ id: "choose:white", sub: "+$3.00" });
    expect(second[13]).toMatchObject({ title: "Cord colour", sub: "Red" });
    expect(pickStep(fungi, { productId: "p1", variantId: "red", choices: ["white"] })).toBeNull();
  });

  it("types money like a till", () => {
    expect([1, 2, 5, 0].reduce<number | null>((c, d) => centsTyped(c, String(d)), null)).toBe(1250);
    expect(centsTyped(1250, "back")).toBe(125);
    expect(centsTyped(5, "back")).toBeNull();
    expect(centsTyped(1250, "clear")).toBeNull();
  });

  it("custom item: price on the pad, the name on the keyboard", () => {
    const k = (custom: DeckState["custom"]) => deckKeys({ ...base, panel: "custom", panelOpen: true, custom }, { name: "main" });
    expect(k({ cents: null, qty: 1, named: true })[0].id).toBe("c:1");
    expect(k({ cents: 1250, qty: 2, named: false })[11]).toMatchObject({ title: "$12.50", sub: "each × 2" });
    expect(k({ cents: 1250, qty: 2, named: false })[13]).toMatchObject({ id: "noop", sub: "type its name" });
    expect(k({ cents: 1250, qty: 2, named: true })[13]).toMatchObject({ id: "c-add", sub: "$25.00" });
  });

  it("codes: the number, then a gift card's PIN", () => {
    const k = (code: DeckState["code"]) => deckKeys({ ...base, panel: "codes", panelOpen: true, code }, { name: "main" });
    expect(k({ code: "", pin: "", field: "code" })[13].id).toBe("noop");
    expect(k({ code: "12345678", pin: "", field: "code" })[11].title).toBe("1234 5678");
    expect(k({ code: "12345678", pin: "", field: "code" })[12].id).toBe("k-field");
    expect(k({ code: "12345678", pin: "123", field: "pin" })[11].title).toBe("CP123");
    expect(k({ code: "12345678", pin: "", field: "code" })[13].id).toBe("k-apply");
  });

  it("start order: tap lamps in, then send once there's a name", () => {
    const k = (qty: Record<string, number>, named: boolean) => deckKeys({ ...base, panel: "order", panelOpen: true, orderDraft: { qty, named } }, { name: "main" });
    expect(k({}, true)[0].id).toBe("o:p1");
    expect(k({ p1: 2 }, false)[0].badge).toBe(2);
    expect(k({ p1: 2 }, false)[13].sub).toBe("type a name");
    expect(k({ p1: 2 }, true)[13].id).toBe("o-send");
    expect(k({ p1: 2 }, true)[11].id).toBe("o-undo");
  });

  it("price check: lamps, then one lamp's price", () => {
    expect(ids({ ...base, panel: "price", panelOpen: true }).slice(0, 3)).toEqual(["pc:p1", "pc:p2", "pc:p3"]);
    const one = deckKeys({ ...base, panel: "price", panelOpen: true, priceFocus: "p2" }, { name: "main" });
    expect(one[1].title).toBe("$45.00");
    expect(one[10].id).toBe("product:p2");
    expect(one[13].id).toBe("pc:none");
  });

  it("show customer: one key per popup, and take it down", () => {
    const k = deckKeys({ ...base, panel: "send", panelOpen: true, showing: "shop" }, { name: "main" });
    expect(k.slice(0, 2).map((x) => x.id)).toEqual(["s:email", "s:shop"]);
    expect(k[1].tone).toBe("invert");
    expect(k[13].id).toBe("s-clear");
  });

  it("staff mode: a PIN pad", () => {
    const k = deckKeys({ ...base, panel: "staff", panelOpen: true, staff: { on: false, step: "again", digits: 1, error: null } }, { name: "main" });
    expect(k[0].id).toBe("st:1");
    expect(k[11]).toMatchObject({ title: "●○○○", sub: "PIN again" });
  });

  it("cash: other amounts on the pad", () => {
    const paying = { ...base, itemCount: 1, totalCents: 4500, canPay: true, pay: "CASH" as const };
    expect(ids(paying)[6]).toBe("cashpad");
    const typed = deckKeys({ ...paying, tenderedCents: 4720 }, { name: "cashpad" });
    expect(typed[0].id).toBe("t:1");
    expect(typed[11].title).toBe("$47.20");
    expect(typed[12].title).toBe("$2.20");
    expect(typed[13].id).toBe("finish");
  });

  it("scan to pay: asks about the card fee", () => {
    const k = ids({ ...base, itemCount: 1, totalCents: 4500, canPay: true, pay: "LINK", feeAsk: true });
    expect([k[6], k[7]]).toEqual(["fee:yes", "fee:no"]);
  });
});
