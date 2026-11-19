"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StreamDeckWeb } from "@elgato-stream-deck/webhid";
import { cn } from "@/lib/cn";
import { centsTyped, COLS, deckKeys, KEYS, pickOnDeck, pickStep, type DeckKey, type DeckPage, type DeckPay, type DeckState } from "@/lib/pos/deck";

/*
 * A Stream Deck plugged into the Mac or PC running the register: ring up
 * lamps, look up customers, take cash with change worked out, and reprint
 * receipts, from real buttons. Chrome and Edge talk to it over WebHID, so
 * there's nothing to install; the first time, "Connect Stream Deck" asks
 * which device, and after that it reconnects by itself.
 *
 * In LightLab's black and white, with the logo blue for the money keys.
 */

export type DeckPanel = "custom" | "codes" | "price" | "order" | "send";
export type DeckActions = {
  /** Adds a lamp; with `picked`, the options chosen on the deck. */
  addProduct: (id: string, picked?: { variantId: string | null; choices: string[] }) => void;
  /** Opens the customer popup for a phone number lookup, starting blank. */
  openLookup: () => void;
  /** A number pad key: a digit, "back" or "clear". */
  lookupType: (key: string) => void;
  lookupFind: () => void;
  /** Locks the register (asking for a new PIN the first time). */
  lock: () => void;
  /** A PIN pad key: a digit, "back", "clear" or "cancel". */
  lockType: (key: string) => void;
  openPanel: (p: DeckPanel) => void;
  closePanel: () => void;
  undoLast: () => void;
  pay: (kind: DeckPay) => void;
  /** Cash handed over; null clears it. */
  tender: (cents: number | null) => void;
  /** Custom item: a pad key for the price ("back", "clear" or a digit), one more, and add it. */
  customType: (key: string) => void;
  customQty: () => void;
  customAdd: () => void;
  /** Code or gift card: a pad key, switch between the code and its PIN, and apply it. */
  codeType: (key: string) => void;
  codeField: () => void;
  codeApply: () => void;
  /** Price check: look at one lamp (null = all of them). */
  priceFocus: (id: string | null) => void;
  /** Start order: one more of a lamp, take back the last tap, send the order form. */
  orderBump: (id: string) => void;
  orderUndo: () => void;
  orderSend: () => void;
  /** Show customer: put a popup on the display, or take it down. */
  send: (tileId: string) => void;
  sendClear: () => void;
  /** Staff mode PIN pad key. */
  staffType: (key: string) => void;
  /** Scan to pay: the customer's answer about covering the card fee. */
  fee: (cover: boolean) => void;
  finish: () => void;
  cancelPay: () => void;
  newSale: () => void;
  /** Prints a stand slip for a sale; returns an error to show, or null. */
  reprint: (orderId: string, slip: "receipt" | "gift" | "claim") => Promise<string | null>;
};

const INK = "#0a0a0a";
const KEY_BG = "#1c1c1c";
const BLUE = "#297f9d";
const WHITE = "#f5f5f5";
const MUTED = "#a3a3a3";
const FAINT = "#5c5c5c";

const hidSupported = () => typeof navigator !== "undefined" && "hid" in navigator;

export function StandDeck({ state, actions }: { state: DeckState; actions: DeckActions }) {
  const [deck, setDeck] = useState<StreamDeckWeb | null>(null);
  const [supported, setSupported] = useState(false);
  const [page, setPage] = useState<DeckPage>({ name: "main" });
  /** Short messages on a key ("Printing", "Tap again"), by key index. */
  const [flash, setFlash] = useState<Record<number, DeckKey>>({});
  const [held, setHeld] = useState<number | null>(null);
  /** Which page of lamps a popup is showing (price check, start order). */
  const [sub, setSub] = useState(0);
  const panel = state.panel;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new popup starts on its first page
    setSub(0);
  }, [panel]);
  const armed = useRef<number>(0);

  // A new sale started (on the deck or the screen): back to the items.
  const wasDone = useRef(false);
  useEffect(() => {
    if (wasDone.current && !state.done) setPage({ name: "main" });
    wasDone.current = !!state.done;
  }, [state.done]);

  const keys = useMemo(() => {
    const k = deckKeys(state, page, sub);
    for (const [i, f] of Object.entries(flash)) k[Number(i)] = f;
    return k;
  }, [state, page, flash, sub]);

  /** A message on key i for a moment. With `keep`, the key still does its job while it shows (Clear's "Tap again"). */
  const say = useCallback((i: number, title: string, sub?: string, ms = 1800, keep?: string) => {
    setFlash((f) => ({ ...f, [i]: { id: keep ?? "noop", tone: "invert", title, sub } }));
    setTimeout(() => setFlash((f) => {
      const next = { ...f };
      delete next[i];
      return next;
    }), ms);
  }, []);

  // ----- What each key does -----
  const latest = useRef({ keys, actions, state, page });
  useEffect(() => {
    latest.current = { keys, actions, state, page };
  });
  const run = useCallback(
    async (i: number) => {
      const { keys, actions: a, state: s, page } = latest.current;
      const id = keys[i]?.id ?? "noop";
      const [kind, arg, arg2] = id.split(":");
      switch (kind) {
        case "product": {
          // Colours and option lists are picked right on the deck.
          const p = s.products.find((x) => x.id === arg);
          // "Add" from a price check: the popup closes first.
          if (s.panel) a.closePanel();
          if (p && pickOnDeck(p) && !s.pay) return setPage({ name: "options", pick: { productId: p.id, variantId: null, choices: [] }, back: page.name === "options" ? page.back : page });
          return a.addProduct(arg);
        }
        case "choose": {
          if (page.name !== "options") return;
          const p = s.products.find((x) => x.id === page.pick.productId);
          const step = p && pickStep(p, page.pick);
          if (!p || !step) return;
          const pick = step.kind === "variant" ? { ...page.pick, variantId: arg } : { ...page.pick, choices: [...page.pick.choices, arg] };
          if (pickStep(p, pick)) return setPage({ ...page, pick });
          a.addProduct(p.id, { variantId: pick.variantId, choices: pick.choices });
          return setPage(page.back);
        }
        case "lookup":
          return a.openLookup();
        case "c":
          return a.customType(arg);
        case "c-qty":
          return a.customQty();
        case "c-add":
          return a.customAdd();
        case "k":
          return a.codeType(arg);
        case "k-field":
          return a.codeField();
        case "k-apply":
          return a.codeApply();
        case "pc":
          return a.priceFocus(arg === "none" ? null : arg);
        case "pc-more":
        case "o-more":
          return setSub((n) => n + 1);
        case "o":
          return a.orderBump(arg);
        case "o-undo":
          return a.orderUndo();
        case "o-send":
          return a.orderSend();
        case "s":
          return a.send(arg);
        case "s-clear":
          return a.sendClear();
        case "st":
          return a.staffType(arg);
        case "fee":
          return a.fee(arg === "yes");
        case "t":
          return a.tender(centsTyped(s.tenderedCents, arg));
        case "cashpad":
          return setPage({ name: "cashpad" });
        case "cashpad-done":
          return setPage({ name: "checkout" });
        case "lock":
          return a.lock();
        case "pin":
          return a.lockType(arg);
        case "digit":
          return a.lookupType(arg);
        case "find":
          return a.lookupFind();
        case "products": {
          const at = page.name === "main" ? (page.page ?? 0) : 0;
          const fit = s.products.length <= 12 ? 12 : 11;
          return setPage({ name: "main", page: (at + 1) * fit < s.products.length ? at + 1 : 0 });
        }
        case "checkout":
          return setPage({ name: "checkout" });
        case "reprint":
          return setPage({ name: "reprint", orderId: null });
        case "pick":
          return setPage({ name: "reprint", orderId: arg });
        case "back":
          return setPage(page.name === "options" ? page.back : { name: "main" });
        case "custom":
        case "codes":
        case "price":
          return a.openPanel(kind);
        case "order":
        case "send":
          return a.openPanel(kind);
        case "close":
          return a.closePanel();
        case "undo":
          return a.undoLast();
        case "pay":
          return a.pay(arg as DeckPay);
        case "tender":
          return a.tender(Number(arg));
        case "finish":
          return a.finish();
        case "cancel":
          return a.cancelPay();
        case "new":
          setPage({ name: "main" });
          return a.newSale();
        case "clear":
          // Two taps, so a bump doesn't wipe the sale.
          if (Date.now() - armed.current < 3000) {
            armed.current = 0;
            setFlash({});
            setPage({ name: "main" });
            return a.newSale();
          }
          armed.current = Date.now();
          return say(i, "Tap again", "to clear", 3000, "clear");
        case "slip": {
          say(i, "Printing", undefined, 4000);
          const err = await a.reprint(arg, arg2 as "receipt" | "gift" | "claim");
          return err ? say(i, "Didn't", "print", 2500) : say(i, "Sent", "to printer");
        }
      }
    },
    [say],
  );

  // ----- Connecting -----
  const attach = useCallback((d: StreamDeckWeb) => {
    // Keys are numbered by where they sit (5 across), whatever the deck's size.
    const at = (c: { row: number; column: number }) => (c.column < COLS ? c.row * COLS + c.column : -1);
    d.on("down", (c) => {
      if (c.type !== "button" || at(c) < 0 || at(c) >= KEYS) return;
      setHeld(at(c));
      void run(at(c));
    });
    d.on("up", (c) => {
      if (c.type === "button") setHeld((h) => (h === at(c) ? null : h));
    });
    d.on("error", () => setDeck((cur) => (cur === d ? null : cur)));
    void d.setBrightness(80).catch(() => undefined);
    setDeck(d);
  }, [run]);

  useEffect(() => {
    if (!hidSupported()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser feature check, after hydration
    setSupported(true);
    let cancelled = false;
    let opened: StreamDeckWeb | null = null;
    const reconnect = async () => {
      const { getStreamDecks } = await import("@elgato-stream-deck/webhid");
      const [d] = await getStreamDecks().catch(() => []);
      if (!d || cancelled) return void d?.close().catch(() => undefined);
      opened = d;
      attach(d);
    };
    void reconnect();
    const onConnect = () => !opened && void reconnect();
    const onDisconnect = () => {
      opened = null;
      setDeck(null);
    };
    navigator.hid.addEventListener("connect", onConnect);
    navigator.hid.addEventListener("disconnect", onDisconnect);
    return () => {
      cancelled = true;
      navigator.hid.removeEventListener("connect", onConnect);
      navigator.hid.removeEventListener("disconnect", onDisconnect);
      if (opened) void opened.clearPanel().then(() => opened?.close()).catch(() => undefined);
    };
  }, [attach]);

  async function connect() {
    const { requestStreamDecks } = await import("@elgato-stream-deck/webhid");
    const [d] = await requestStreamDecks().catch(() => []);
    if (d) attach(d);
  }

  // ----- Drawing -----
  const drawn = useRef<string[]>([]);
  const busy = useRef(Promise.resolve());
  useEffect(() => {
    if (!deck) {
      drawn.current = [];
      return;
    }
    const controls = deck.modelInfo.controls;
    const button = controls.find((c) => c.type === "button" && c.feedbackType === "lcd");
    const size = button && "pixelSize" in button ? button.pixelSize.width : 72;
    busy.current = busy.current.then(async () => {
      const font = await deckFont();
      for (const b of controls) {
        if (b.type !== "button" || b.feedbackType !== "lcd") continue;
        // Bigger decks keep the 5 × 3 layout in the top-left corner; the other keys stay dark.
        const i = b.row * COLS + b.column;
        const spec: DeckKey = b.column < COLS && i < KEYS ? keys[i] : { id: "noop", tone: "blank" };
        const pressed = held === i && spec.tone !== "blank" && spec.id !== "noop";
        const sig = JSON.stringify([spec, pressed]);
        if (drawn.current[b.index] === sig) continue;
        drawn.current[b.index] = sig;
        const canvas = await drawKey(spec, size, font, pressed);
        await deck.fillKeyCanvas(b.index, canvas).catch(() => {
          drawn.current[b.index] = "";
        });
      }
    });
  }, [deck, keys, held]);

  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={deck ? undefined : connect}
      title={deck ? "The Stream Deck is running the register's keys" : "Use a Stream Deck plugged into this computer"}
      className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm", deck ? "cursor-default border-line text-muted" : "border-line font-semibold hover:border-accent-line")}
    >
      <span className={cn("h-2 w-2 rounded-full", deck ? "bg-success" : "bg-faint")} />
      {deck ? "Stream Deck" : "Connect Stream Deck"}
    </button>
  );
}

// ----- Key art -----

let fontPromise: Promise<string> | null = null;
/** LightLab's Gabarito, the same font the stand pages use. */
function deckFont() {
  fontPromise ??= (async () => {
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-ll-sans").trim() || "system-ui, sans-serif";
    await Promise.all([document.fonts.load(`800 20px ${family}`), document.fonts.load(`500 12px ${family}`)]).catch(() => undefined);
    return family;
  })();
  return fontPromise;
}

const images = new Map<string, Promise<HTMLImageElement | null>>();
function loadImage(src: string) {
  if (!images.has(src)) {
    images.set(
      src,
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      }),
    );
  }
  return images.get(src)!;
}

/** Largest font (up to `max`) that fits `text` in `width`. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, max: number, width: number, font: string) {
  let px = max;
  for (; px > 8; px--) {
    ctx.font = `${weight} ${px}px ${font}`;
    if (ctx.measureText(text).width <= width) break;
  }
  return px;
}

async function drawKey(k: DeckKey, size: number, font: string, pressed: boolean) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const s = size / 72;
  const tone = pressed ? (k.tone === "invert" ? "plain" : "invert") : k.tone;
  const bg = tone === "accent" ? BLUE : tone === "invert" ? WHITE : tone === "plain" ? KEY_BG : INK;
  const fg = tone === "invert" ? INK : tone === "dim" ? FAINT : WHITE;
  const sub = tone === "invert" ? "#404040" : tone === "accent" ? "#d8eef5" : tone === "dim" ? FAINT : MUTED;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  if (tone === "blank") return c;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const img = k.image ? await loadImage(k.image) : null;
  if (k.swatch) {
    // A colour to pick: a big dot, then its name and price.
    const r = 15 * s;
    ctx.globalAlpha = tone === "dim" ? 0.3 : 1;
    ctx.fillStyle = k.swatch;
    ctx.beginPath();
    ctx.arc(size / 2, 22 * s, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5 * s;
    ctx.strokeStyle = tone === "invert" ? "#cccccc" : "#5c5c5c";
    ctx.stroke();
    ctx.fillStyle = fg;
    fit(ctx, k.title ?? "", 700, 13 * s, size - 6 * s, font);
    ctx.fillText(k.title ?? "", size / 2, 52 * s);
    if (k.sub) {
      ctx.fillStyle = sub;
      fit(ctx, k.sub, 500, 10 * s, size - 6 * s, font);
      ctx.fillText(k.sub, size / 2, 65 * s);
    }
  } else if (img) {
    // Product photo, cropped square, with the name and price on a black strip.
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.globalAlpha = tone === "dim" ? 0.3 : 1;
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    ctx.globalAlpha = 1;
    const strip = 26 * s;
    ctx.fillStyle = pressed ? WHITE : "rgba(10,10,10,0.88)";
    ctx.fillRect(0, size - strip, size, strip);
    ctx.fillStyle = pressed ? INK : WHITE;
    fit(ctx, k.title ?? "", 700, 11 * s, size - 6 * s, font);
    ctx.fillText(k.title ?? "", size / 2, size - 15 * s);
    ctx.fillStyle = pressed ? "#404040" : MUTED;
    ctx.font = `500 ${10 * s}px ${font}`;
    ctx.fillText(k.sub ?? "", size / 2, size - 4 * s);
  } else {
    const title = k.title ?? "";
    const px = fit(ctx, title, 800, (k.sub ? 19 : 22) * s, size - 8 * s, font);
    ctx.fillStyle = fg;
    ctx.fillText(title, size / 2, k.sub ? size / 2 + px * 0.2 : size / 2 + px * 0.36);
    if (k.sub) {
      ctx.fillStyle = sub;
      fit(ctx, k.sub, 500, 11 * s, size - 6 * s, font);
      ctx.fillText(k.sub, size / 2, size / 2 + px * 0.2 + 16 * s);
    }
  }

  if (k.badge) {
    const r = 11 * s;
    ctx.fillStyle = pressed ? INK : WHITE;
    ctx.beginPath();
    ctx.arc(size - r - 3 * s, r + 3 * s, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pressed ? WHITE : INK;
    ctx.font = `800 ${13 * s}px ${font}`;
    ctx.textBaseline = "middle";
    ctx.fillText(String(k.badge), size - r - 3 * s, r + 3.5 * s);
  }
  return c;
}
