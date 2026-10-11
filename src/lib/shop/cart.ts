"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { shopConfig, type ShopId } from "@config/shops";
import type { OrderQuote } from "@/lib/pricing/quote";
import type { ServerQuoteState } from "@/lib/order/use-quote";
import type { PricedShopLine, ShopLineInput } from "./types";

/** A product in a shop cart, with what the cart shows about it. Prices are re-checked by the server. */
export type ShopCartLine = ShopLineInput & {
  key: string;
  slug: string;
  name: string;
  variantName: string | null;
  swatch: string | null;
  image: string | null;
  unitCents: number;
  /** How many can be bought (null = made to order). */
  max: number | null;
};

type ShopCart = {
  lines: ShopCartLine[];
  /** The cart drawer. */
  open: boolean;
  setOpen: (open: boolean) => void;
  add: (line: Omit<ShopCartLine, "key">) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  reset: () => void;
  /** The server's current prices and names (the admin may have changed them). */
  sync: (priced: PricedShopLine[]) => void;
};

/** One line per product, option and personalisation (two keychains with different names are two lines). */
// Same keys as before personalisation existed, so carts already saved in browsers still match.
const keyOf = (productId: string, variantId: string | null, customText?: string | null) => `${productId}:${variantId ?? ""}${customText ? `:${customText}` : ""}`;

/** Each shop has its own cart, saved in the browser under its own name. */
function makeShopCart(shop: ShopId) {
  const { maxQuantityPerLine, maxLinesPerOrder } = shopConfig(shop);
  const clampQty = (q: number, max: number | null) => Math.max(1, Math.min(maxQuantityPerLine, max ?? Infinity, Math.round(q)));
  return create<ShopCart>()(
    persist(
      (set) => ({
        lines: [],
        open: false,
        setOpen: (open) => set({ open }),
        add: (line) =>
          set((s) => {
            const key = keyOf(line.productId, line.variantId, line.customText);
            const have = s.lines.find((l) => l.key === key);
            if (have) return { open: true, lines: s.lines.map((l) => (l.key === key ? { ...l, ...line, key, quantity: clampQty(l.quantity + line.quantity, line.max) } : l)) };
            if (s.lines.length >= maxLinesPerOrder) return { open: true };
            return { open: true, lines: [...s.lines, { ...line, key, quantity: clampQty(line.quantity, line.max) }] };
          }),
        setQuantity: (key, quantity) => set((s) => ({ lines: s.lines.map((l) => (l.key === key ? { ...l, quantity: clampQty(quantity, l.max) } : l)) })),
        remove: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),
        reset: () => set({ lines: [], open: false }),
        sync: (priced) =>
          set((s) => {
            const by = new Map(priced.map((p) => [keyOf(p.productId, p.variantId, p.customText), p]));
            let changed = false;
            const lines = s.lines.map((l) => {
              const p = by.get(l.key);
              if (!p || (p.unitCents === l.unitCents && p.name === l.name)) return l;
              changed = true;
              return { ...l, unitCents: p.unitCents, name: p.name, variantName: p.variantName };
            });
            return changed ? { lines } : {};
          }),
      }),
      {
        name: `${shop}-cart`,
        storage: createJSONStorage(() => localStorage),
        partialize: (s) => ({ lines: s.lines }),
      },
    ),
  );
}

const carts = { lightlab: makeShopCart("lightlab"), coastline: makeShopCart("coastline") };
/** The cart store for a shop (a zustand hook). */
export const cartFor = (shop: ShopId = "lightlab") => carts[shop];
/** The LightLab cart. */
export const useShopCart = carts.lightlab;

export const shopPayload = (lines: ShopCartLine[]): ShopLineInput[] => lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity, customText: l.customText ?? null }));

/** Waits for the saved cart to load from the browser (it isn't there during the server render). */
export function useShopCartHydrated(shop: ShopId = "lightlab") {
  const store = carts[shop];
  return useSyncExternalStore(
    (cb) => store.persist.onFinishHydration(cb),
    () => store.persist.hasHydrated(),
    () => false,
  );
}

/**
 * Same shape as the print quote (useCartQuote), so checkout takes either:
 * an instant estimate from the cart, replaced by the server's price.
 */
export function useShopQuote(lines: ShopCartLine[], shop: ShopId = "lightlab") {
  const local = useMemo<OrderQuote | null>(() => {
    if (!lines.length) return null;
    const subtotalCents = lines.reduce((s, l) => s + l.unitCents * l.quantity, 0);
    return { items: [], baseFeeCents: 0, subtotalCents, minimumAdjCents: 0, totalCents: subtotalCents, ok: true, shipping: null };
  }, [lines]);

  const signature = lines.length ? JSON.stringify(shopPayload(lines)) : "";
  const [server, setServer] = useState<ServerQuoteState>({ status: "idle" });
  useEffect(() => {
    if (!signature) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setServer({ status: "loading" });
      // A dropped connection gets two more tries before showing an error.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch("/api/shop/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ products: JSON.parse(signature) }), signal: ctrl.signal });
          const body = await res.json();
          if (!res.ok) setServer({ status: "error", message: body.error ?? "Couldn't confirm the price." });
          else {
            setServer({ status: "ok", quote: body.quote, signature });
            carts[shop].getState().sync(body.lines ?? []);
          }
          return;
        } catch (err) {
          if ((err as Error).name === "AbortError") return;
          if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
      if (!ctrl.signal.aborted) setServer({ status: "error", message: "Couldn't reach the server to confirm the price." });
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [signature, shop]);

  const confirmed = server.status === "ok" && server.signature === signature ? server.quote : null;
  return { quote: confirmed ?? local, confirmed: !!confirmed, server, ready: lines.length > 0 };
}
