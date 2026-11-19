import { money } from "@/lib/format";

/*
 * The Stream Deck at the stand: which key shows what, for each moment of a
 * sale. Pure, so it's easy to test; src/components/pos/StandDeck.tsx draws
 * the keys and runs what they do.
 *
 * Laid out for the 15-key Stream Deck (5 across, 3 down). The first page is
 * every item for sale, with Customer, Lock and Checkout along the bottom;
 * Checkout leads to the rest (codes, reprints, payment, clear). On every other page the
 * bottom-right key gets you out: clear, close, back, cancel or new sale.
 */

export type DeckTone = "plain" | "accent" | "invert" | "dim" | "blank";
export type DeckKey = {
  /** What a press does (see StandDeck's run()); "noop" does nothing. */
  id: string;
  tone: DeckTone;
  title?: string;
  sub?: string;
  /** A product photo filling the key. */
  image?: string;
  /** A count in the corner (how many are in the sale). */
  badge?: number;
  /** A colour swatch (a lamp's shade or cord colour). */
  swatch?: string;
};

export type DeckChoice = { id: string; name: string; hex: string | null; /** What it costs (variants), or what it adds (option choices). */ cents: number; soldOut: boolean };
export type DeckProduct = {
  id: string;
  name: string;
  priceCents: number;
  image: string | null;
  soldOut: boolean;
  inSale: number;
  /** Colours (or other main options) to pick from. Empty = none. */
  variants: DeckChoice[];
  /** More lists to pick from, like cord colour. */
  optionSets: { id: string; name: string; choices: DeckChoice[] }[];
  /** Needs typing (a name on it): the options open on the screen instead. */
  personalize: boolean;
};
export type DeckPay = "CASH" | "CARD" | "LINK" | "ETRANSFER" | "OTHER";
/** "other" = a popup the deck can't help with (prints from a file, a lamp's name): just Close. */
export type DeckPanelName = "customer" | "custom" | "codes" | "price" | "order" | "send" | "staff" | "other";
export type RecentSale = { orderId: string; orderNumber: string; totalCents: number; at: string };

export type DeckState = {
  products: DeckProduct[];
  itemCount: number;
  totalCents: number | null;
  /** Payment can be taken (priced, and not waiting on an order form). */
  canPay: boolean;
  pay: DeckPay | null;
  saving: boolean;
  tenderedCents: number | null;
  linkPaid: boolean;
  done: { orderId: string; orderNumber: string; changeCents: number | null; offline: boolean } | null;
  panelOpen: boolean;
  customer: string | null;
  codes: number;
  order: string | null;
  payLinks: boolean;
  etransfer: boolean;
  recent: RecentSale[];
  /** Which popup is open on the screen. The deck shows what it needs: a number pad, products, choices. */
  panel: DeckPanelName | null;
  /** The customer lookup popup: what's typed, and how the search went. */
  lookup: { open: boolean; q: string; status: "idle" | "busy" | "found" | "missing"; name: string | null };
  /** Custom item: the price typed so far, how many, and whether it has a name yet (typed on the keyboard). */
  custom: { cents: number | null; qty: number; named: boolean };
  /** Code or gift card being typed, and its PIN (gift cards, CP#####). */
  code: { code: string; pin: string; field: "code" | "pin" };
  /** Price check: the product picked to look at. */
  priceFocus: string | null;
  /** Start order: how many of each product, and whether their first name is typed in. */
  orderDraft: { qty: Record<string, number>; named: boolean };
  /** Show customer: what can be put on the display, and what's showing now. */
  sendTiles: { id: string; title: string; sub: string }[];
  showing: string | null;
  /** Staff mode PIN: turning it on (pick a PIN, then again) or off. */
  staff: { on: boolean; step: "pin" | "again"; digits: number; error: string | null };
  /** Scan to pay: waiting for the customer's answer about covering the card fee. */
  feeAsk: boolean;
  /** The register lock: picking a PIN, or locked. Takes over every key while it's on. */
  lock: { mode: "off" | "set" | "again" | "locked"; digits: number; error: string | null };
};

/** A lamp's options being picked on the deck: the main option first, then each option set. */
export type DeckPick = { productId: string; variantId: string | null; choices: string[] };

export type DeckPage =
  /** Every item to sell, 13 to a page, with Checkout in the corner. */
  | { name: "main"; page?: number }
  /** Everything else: customer, codes, reprints, payment, clear. */
  | { name: "checkout" }
  | { name: "reprint"; orderId: string | null }
  /** Typing the cash they handed over on the number pad. */
  | { name: "cashpad" }
  | { name: "options"; pick: DeckPick; back: DeckPage };

export const COLS = 5;
export const KEYS = 15;

const blank = (): DeckKey => ({ id: "noop", tone: "blank" });
const key = (id: string, title: string, sub?: string, tone: DeckTone = "plain"): DeckKey => ({ id, tone, title, sub });
const off = (title: string, sub?: string): DeckKey => ({ id: "noop", tone: "dim", title, sub });

function productKey(p: DeckProduct): DeckKey {
  return { id: p.soldOut ? "noop" : `product:${p.id}`, tone: p.soldOut ? "dim" : "plain", title: p.name, sub: p.soldOut ? "Sold out" : money(p.priceCents), image: p.image ?? undefined, badge: p.inSale || undefined };
}

/** Cash amounts to tap: exact, then the bills they're likely to hand over. Same as the register's buttons. */
export function cashQuick(totalCents: number) {
  return [...new Set([totalCents, ...[500, 1000, 2000, 5000, 10000].map((b) => Math.ceil(totalCents / b) * b)].filter((c) => c >= totalCents))].slice(0, 4);
}

/** Picking on the deck works for colours and option lists; typing a name needs the screen. */
export const pickOnDeck = (p: DeckProduct) => !p.personalize && (p.variants.length > 0 || p.optionSets.length > 0);

/** Which list is being picked from next, or null once everything's chosen. */
export function pickStep(p: DeckProduct, pick: DeckPick): { title: string; choices: DeckChoice[]; kind: "variant" | "choice" } | null {
  if (p.variants.length && !pick.variantId) return { title: "Colour", choices: p.variants, kind: "variant" };
  const set = p.optionSets.filter((x) => x.choices.length)[pick.choices.length];
  return set ? { title: set.name, choices: set.choices, kind: "choice" } : null;
}

/** "Fun-gi" + "Blue, Black cord" style summary of the picks so far. */
function picked(p: DeckProduct, pick: DeckPick) {
  const names = [p.variants.find((v) => v.id === pick.variantId)?.name, ...pick.choices.map((c) => p.optionSets.flatMap((s) => s.choices).find((x) => x.id === c)?.name)].filter(Boolean);
  return names.join(", ");
}

/** Phone digits as they'd be written: 250 555 0101. */
export function phoneShown(q: string) {
  const d = q.replace(/\D/g, "");
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/** A number pad on keys 0 to 9 (1 2 3 4 5 / 6 7 8 9 0), each sending `prefix:digit`. */
function pad(k: DeckKey[], prefix: string) {
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].forEach((n, i) => (k[i] = key(`${prefix}:${n}`, String(n))));
}

/** Typing money on a pad, like a till: 1, 2, 5, 0 is $12.50. */
export function centsTyped(cents: number | null, k: string) {
  const c = cents ?? 0;
  if (k === "clear") return null;
  if (k === "back") return c >= 10 ? Math.floor(c / 10) : null;
  return /^\d$/.test(k) && c < 10_000_000 ? c * 10 + Number(k) : c;
}

/** "1234 5678 9012" so a long code is easy to check. */
const grouped = (code: string) => code.replace(/(.{4})(?=.)/g, "$1 ");

/** Keys for the popup that's open, or null when the deck doesn't take it over. */
function panelKeys(s: DeckState, sub: number): DeckKey[] | null {
  const k: DeckKey[] = Array.from({ length: KEYS }, blank);
  const close = key("close", "Close", "popup");
  switch (s.panel) {
    case "customer": {
      // A number pad for their phone number.
      pad(k, "digit");
      const l = s.lookup;
      k[10] = l.q ? key("digit:back", "Delete") : off("Delete");
      k[11] =
        l.status === "busy" ? off("Looking", "...") : l.status === "found" ? key("noop", l.name ?? "Found", "found", "invert") : l.status === "missing" ? key("noop", "No match", phoneShown(l.q) || undefined, "invert") : key("noop", phoneShown(l.q) || "Phone", l.q ? "typed" : "number", "invert");
      k[12] = l.q ? key("digit:clear", "Clear") : off("Clear");
      k[13] = l.status === "found" ? key("close", "Done", undefined, "accent") : l.q.replace(/\D/g, "").length >= 3 && l.status !== "busy" ? key("find", "Enter", "look up", "accent") : off("Enter", "look up");
      k[14] = close;
      return k;
    }
    case "custom": {
      // The price on the pad; the name is typed on the keyboard.
      const c = s.custom;
      pad(k, "c");
      k[10] = c.cents ? key("c:back", "Delete") : off("Delete");
      k[11] = key("noop", money(c.cents ?? 0), c.qty > 1 ? `each × ${c.qty}` : "price each", "invert");
      k[12] = key("c-qty", `× ${c.qty}`, "tap for more");
      k[13] = c.cents == null ? off("Add", "type a price") : !c.named ? off("Add", "type its name") : key("c-add", "Add", money(c.cents * c.qty), "accent");
      k[14] = close;
      return k;
    }
    case "codes": {
      const c = s.code;
      pad(k, "k");
      const typed = c.field === "pin" ? c.pin : c.code;
      k[10] = typed ? key("k:back", "Delete") : off("Delete");
      k[11] = c.field === "pin" ? key("noop", `CP${c.pin}` || "CP", "gift card PIN", "invert") : key("noop", c.code ? grouped(c.code) : "Code", c.code ? `${c.code.length} digits` : "or gift card", "invert");
      k[12] = c.field === "pin" ? key("k-field", "Code", "back to it") : c.code ? key("k-field", "PIN", "gift cards") : off("PIN", "gift cards");
      k[13] = c.code ? key("k-apply", "Apply", s.codes ? `${s.codes} on sale` : undefined, "accent") : off("Apply", s.codes ? `${s.codes} on sale` : undefined);
      k[14] = close;
      return k;
    }
    case "price": {
      const p = s.products.find((x) => x.id === s.priceFocus);
      if (p) {
        // One lamp: its price, then what's left of each colour.
        k[0] = { ...productKey(p), id: "noop", badge: undefined };
        k[1] = key("noop", money(p.priceCents), "price", "invert");
        const rows = p.variants.length ? p.variants.map((v) => ({ name: v.name, sub: v.soldOut ? "sold out" : money(v.cents), hex: v.hex })) : [];
        rows.slice(0, 8).forEach((r, i) => (k[2 + i] = { id: "noop", tone: "plain", title: r.name, sub: r.sub, swatch: r.hex ?? undefined }));
        k[10] = p.soldOut ? off("Add", "sold out") : key(`product:${p.id}`, "Add", "to sale", "accent");
        k[13] = key("pc:none", "Back", "all lamps");
        k[14] = close;
        return k;
      }
      productPage(k, s.products, sub, (x) => ({ ...productKey(x), id: `pc:${x.id}`, badge: undefined }), "pc-more");
      k[14] = close;
      return k;
    }
    case "order": {
      // What they're ordering: each tap is one more. The first name is typed on the keyboard.
      const n = Object.values(s.orderDraft.qty).reduce((a, b) => a + b, 0);
      productPage(k, s.products, sub, (x) => ({ ...productKey(x), id: x.soldOut ? "noop" : `o:${x.id}`, badge: s.orderDraft.qty[x.id] || undefined }), "o-more", 11);
      k[11] = n ? key("o-undo", "Undo", "last tap") : off("Undo");
      k[12] = sub > 0 || s.products.length > 11 ? key("o-more", "More", "lamps") : blank();
      k[13] = !n ? off("Send", "pick lamps") : !s.orderDraft.named ? off("Send", "type a name") : key("o-send", "Send", `${n} to the form`, "accent");
      k[14] = close;
      return k;
    }
    case "send": {
      s.sendTiles.slice(0, 10).forEach((t, i) => (k[i] = key(`s:${t.id}`, t.title, t.sub, s.showing === t.id ? "invert" : "plain")));
      k[13] = s.showing ? key("s-clear", "Take", "it down") : blank();
      k[14] = close;
      return k;
    }
    case "staff": {
      const st = s.staff;
      pad(k, "st");
      k[10] = st.digits ? key("st:back", "Delete") : off("Delete");
      k[11] = key("noop", "●".repeat(st.digits) + "○".repeat(4 - st.digits), st.error ?? (st.on ? "PIN to leave" : st.step === "pin" ? "new staff PIN" : "PIN again"), "invert");
      k[12] = st.digits ? key("st:clear", "Clear") : off("Clear");
      k[14] = close;
      return k;
    }
    case "other":
      k[0] = off("On the", "screen");
      k[14] = close;
      return k;
    default:
      return null;
  }
}

/** Products 0 to n-1 on keys, a page at a time. */
function productPage(k: DeckKey[], products: DeckProduct[], sub: number, toKey: (p: DeckProduct) => DeckKey, moreId: string, n = 13) {
  const pages = Math.max(1, Math.ceil(products.length / n));
  const at = sub % pages;
  products.slice(at * n, (at + 1) * n).forEach((p, i) => (k[i] = toKey(p)));
  if (pages > 1 && n === 13) k[13] = key(moreId, "More", `page ${at + 1} of ${pages}`);
}

/** The 15 keys for this moment. A finished sale or a payment in progress takes over from the page. */
export function deckKeys(s: DeckState, page: DeckPage, sub = 0): DeckKey[] {
  const k: DeckKey[] = Array.from({ length: KEYS }, blank);
  const due = s.totalCents != null ? money(s.totalCents) : "$0";

  if (s.lock.mode !== "off") {
    // A PIN pad. It checks itself after the 4th digit.
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].forEach((n, i) => (k[i] = key(`pin:${n}`, String(n))));
    k[10] = s.lock.digits ? key("pin:back", "Delete") : off("Delete");
    const dots = "●".repeat(s.lock.digits) + "○".repeat(4 - s.lock.digits);
    const title = s.lock.mode === "locked" ? "Locked" : s.lock.mode === "set" ? "New PIN" : "Again";
    k[11] = key("noop", dots, s.lock.error ?? title, "invert");
    k[12] = s.lock.digits ? key("pin:clear", "Clear") : off("Clear");
    if (s.lock.mode !== "locked") k[14] = key("pin:cancel", "Cancel");
    return k;
  }

  if (s.done) {
    const d = s.done;
    k[0] = key("noop", d.offline ? "Saved" : "Sold", d.offline ? "offline" : `#${d.orderNumber}`, "invert");
    if (d.changeCents != null) k[1] = key("noop", money(d.changeCents), "change", "accent");
    if (!d.offline) {
      k[10] = key(`slip:${d.orderId}:receipt`, "Receipt", "print again");
      k[11] = key(`slip:${d.orderId}:gift`, "Gift", "receipt");
    }
    k[14] = key("new", "New", "sale", "accent");
    return k;
  }

  if (s.pay) {
    k[0] = key("noop", due, "due", "invert");
    const finish = (label: string, sub: string) => (s.saving ? off("Ringing", "up...") : key("finish", label, sub, "accent"));
    if (s.pay === "CASH" && s.totalCents != null && page.name === "cashpad") {
      // Typing what they handed over.
      pad(k, "t");
      const change = s.tenderedCents != null ? s.tenderedCents - s.totalCents : null;
      k[10] = s.tenderedCents ? key("t:back", "Delete") : off("Delete");
      k[11] = key("noop", money(s.tenderedCents ?? 0), "given", "invert");
      k[12] = change == null ? off("Change", `due ${due}`) : change < 0 ? off(money(-change), "still owed") : key("noop", money(change), "change", "invert");
      k[13] = change != null && change < 0 ? off("Finish", "not enough") : finish("Cash in", "finish");
      k[14] = s.saving ? blank() : key("cashpad-done", "Back", "amounts");
      return k;
    }
    if (s.pay === "CASH" && s.totalCents != null) {
      cashQuick(s.totalCents).forEach((c, i) => {
        k[1 + i] = key(`tender:${c}`, c === s.totalCents ? "Exact" : money(c), c === s.totalCents ? money(c) : "given", s.tenderedCents === c ? "invert" : "plain");
      });
      const change = s.tenderedCents != null ? s.tenderedCents - s.totalCents : null;
      if (change != null) k[5] = change < 0 ? off(money(-change), "still owed") : key("noop", money(change), "change", "invert");
      k[6] = key("cashpad", "Other", "amount");
      k[13] = change != null && change < 0 ? off("Finish", "not enough") : finish("Cash in", "finish");
    } else if (s.pay === "CARD") {
      k[5] = off("Use your", "card reader");
      k[13] = finish("Approved", "finish");
    } else if (s.pay === "LINK") {
      k[5] = s.linkPaid ? key("noop", "Paid", "finishing", "invert") : s.feeAsk ? off("Card fee?", "ask them") : off("Waiting", "for the scan");
      if (s.feeAsk) {
        k[6] = key("fee:yes", "They", "cover it");
        k[7] = key("fee:no", "No fee", "no thanks");
      }
    } else {
      k[13] = finish(s.pay === "ETRANSFER" ? "Got it" : "Finish", s.pay === "ETRANSFER" ? "finish" : "sale");
    }
    k[14] = s.saving ? blank() : key("cancel", "Cancel", "payment");
    return k;
  }

  const popup = panelKeys(s, sub);
  if (popup) return popup;

  if (page.name === "options") {
    const p = s.products.find((x) => x.id === page.pick.productId);
    const step = p && pickStep(p, page.pick);
    if (p && step) {
      step.choices.slice(0, 13).forEach((c, i) => {
        const price = step.kind === "variant" ? money(c.cents) : c.cents ? `+${money(c.cents)}` : undefined;
        k[i] = { id: c.soldOut ? "noop" : `choose:${c.id}`, tone: c.soldOut ? "dim" : "plain", title: c.name, sub: c.soldOut ? "Sold out" : price, swatch: c.hex ?? undefined };
      });
      k[13] = off(step.title, picked(p, page.pick) || p.name);
      k[14] = key("back", "Back", undefined, "accent");
      return k;
    }
  }

  if (page.name === "checkout") {
    k[0] = key("lookup", s.customer ?? "Customer", s.customer ? "customer" : "look up", s.customer ? "invert" : "plain");
    k[1] = key("custom", "Custom", "item");
    k[2] = { ...key("codes", "Code", "gift card"), badge: s.codes || undefined };
    k[3] = key("price", "Price", "check");
    k[4] = key("reprint", "Reprint", "receipt");
    k[5] = s.itemCount ? key("undo", due, "undo last") : off(due, "no items");
    k[6] = s.canPay && s.etransfer ? key("pay:ETRANSFER", "e-Transfer", "pay") : off("e-Transfer", "pay");
    k[7] = s.payLinks ? (s.canPay && (s.totalCents ?? 0) >= 100 && !s.order ? key("pay:LINK", "Scan", "to pay") : off("Scan", "to pay")) : blank();
    k[8] = s.canPay && !s.order ? key("pay:OTHER", "Other", "payment") : off("Other", "payment");
    k[9] = key("order", s.order ? s.order : "Start", s.order ? "order" : "an order", s.order ? "invert" : "plain");
    k[10] = key("back", "Items", `${s.itemCount} in sale`);
    k[11] = s.canPay ? key("pay:CASH", "Cash", undefined, "accent") : off("Cash");
    k[12] = s.canPay && !s.order ? key("pay:CARD", "Card", undefined, "accent") : off("Card");
    k[13] = key("send", "Show", "customer");
    k[14] = s.panelOpen ? key("close", "Close", "popup") : s.itemCount || s.order ? key("clear", "Clear", "sale") : off("Clear", "sale");
    return k;
  }

  if (page.name === "reprint") {
    if (!s.recent.length) {
      k[0] = off("No sales", "yet");
    } else {
      const picked = page.orderId ?? s.recent[0].orderId;
      s.recent.slice(0, 5).forEach((r, i) => (k[i] = key(`pick:${r.orderId}`, `#${r.orderNumber}`, money(r.totalCents), r.orderId === picked ? "invert" : "plain")));
      k[5] = key(`slip:${picked}:receipt`, "Receipt");
      k[6] = key(`slip:${picked}:gift`, "Gift", "receipt");
      k[7] = key(`slip:${picked}:claim`, "Order", "ticket");
    }
    k[14] = key("checkout", "Back", undefined, "accent");
    return k;
  }

  // Main: every item, then Customer, Lock and Checkout along the bottom.
  const fit = s.products.length <= 12 ? 12 : 11;
  const pages = Math.max(1, Math.ceil(s.products.length / fit));
  const at = page.name === "main" ? Math.min(page.page ?? 0, pages - 1) : 0;
  s.products.slice(at * fit, (at + 1) * fit).forEach((p, i) => (k[i] = productKey(p)));
  if (!s.products.length) k[0] = off("No items", "yet");
  if (pages > 1) k[11] = key("products:next", "More", `page ${at + 1} of ${pages}`);
  k[12] = key("lookup", s.customer ?? "Customer", s.customer ? "customer" : "look up", s.customer ? "invert" : "plain");
  k[13] = key("lock", "Lock", "register");
  k[14] = key("checkout", "Checkout", s.itemCount ? `${due} · ${s.itemCount}` : "& more", "accent");
  return k;
}
