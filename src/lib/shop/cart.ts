"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { lightlab } from "@config/lightlab";
import type { OrderQuote } from "@/lib/pricing/quote";
import type { ServerQuoteState } from "@/lib/order/use-quote";
import type { PricedShopLine, ShopLineInput } from "./types";

/** A product in the LightLab cart, with what the cart shows about it. Prices are re-checked by the server. */
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

const keyOf = (productId: string, variantId: string | null) => `${productId}:${variantId ?? ""}`;
const clampQty = (q: number, max: number | null) => Math.max(1, Math.min(lightlab.maxQuantityPerLine, max ?? Infinity, Math.round(q)));

export const useShopCart = create<ShopCart>()(
  persist(
    (set) => ({
      lines: [],
      open: false,
      setOpen: (open) => set({ open }),
      add: (line) =>
        set((s) => {
          const key = keyOf(line.productId, line.variantId);
          const have = s.lines.find((l) => l.key === key);
          if (have) return { open: true, lines: s.lines.map((l) => (l.key === key ? { ...l, ...line, key, quantity: clampQty(l.quantity + line.quantity, line.max) } : l)) };
          if (s.lines.length >= lightlab.maxLinesPerOrder) return { open: true };
          return { open: true, lines: [...s.lines, { ...line, key, quantity: clampQty(line.quantity, line.max) }] };
        }),
      setQuantity: (key, quantity) => set((s) => ({ lines: s.lines.map((l) => (l.key === key ? { ...l, quantity: clampQty(quantity, l.max) } : l)) })),
      remove: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),
      reset: () => set({ lines: [], open: false }),
      sync: (priced) =>
        set((s) => {
          const by = new Map(priced.map((p) => [keyOf(p.productId, p.variantId), p]));
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
      name: "lightlab-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lines: s.lines }),
    },
  ),
);

export const shopPayload = (lines: ShopCartLine[]): ShopLineInput[] => lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity }));

/** Waits for the saved cart to load from the browser (it isn't there during the server render). */
export function useShopCartHydrated() {
  return useSyncExternalStore(
    (cb) => useShopCart.persist.onFinishHydration(cb),
    () => useShopCart.persist.hasHydrated(),
    () => false,
  );
}

/**
 * Same shape as the print quote (useCartQuote), so checkout takes either:
 * an instant estimate from the cart, replaced by the server's price.
 */
export function useShopQuote(lines: ShopCartLine[]) {
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
            useShopCart.getState().sync(body.lines ?? []);
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
  }, [signature]);

  const confirmed = server.status === "ok" && server.signature === signature ? server.quote : null;
  return { quote: confirmed ?? local, confirmed: !!confirmed, server, ready: lines.length > 0 };
}
