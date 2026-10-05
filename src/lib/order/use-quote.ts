"use client";
import { useEffect, useMemo, useState } from "react";
import { useConfig } from "@/components/ConfigProvider";
import { quoteOrder, type OrderQuote } from "@/lib/pricing/quote";
import { itemSpec } from "./derive";
import type { CartItem } from "./store";

export type ServerQuoteState =
  | { status: "idle" | "loading" }
  | { status: "ok"; quote: OrderQuote; signature: string }
  | { status: "error"; message: string };

/** The fields that change the price. Used to match a server answer to the current cart. */
export function cartPayload(items: CartItem[]) {
  return items.map((i) => ({
    uploadId: i.upload!.id,
    unitFactor: i.unitFactor,
    scale: i.scale,
    material: i.material,
    colorId: i.colorId,
    quality: i.quality,
    infill: i.infill,
    quantity: i.quantity,
  }));
}

/**
 * Instant client estimate (same engine as the server) plus a debounced
 * server check. The server number wins whenever it matches the current cart.
 */
export function useCartQuote(items: CartItem[]) {
  const cfg = useConfig();

  const local = useMemo(() => {
    const specs = items.map(itemSpec);
    if (!specs.length || specs.some((s) => !s)) return null;
    return quoteOrder(specs as NonNullable<(typeof specs)[number]>[], cfg);
  }, [items, cfg]);

  const ready = items.length > 0 && items.every((i) => i.phase === "ready" && i.upload);
  const signature = ready ? JSON.stringify(cartPayload(items)) : "";
  const [server, setServer] = useState<ServerQuoteState>({ status: "idle" });

  useEffect(() => {
    if (!signature) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setServer({ status: "loading" });
      try {
        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: JSON.parse(signature) }),
          signal: ctrl.signal,
        });
        const body = await res.json();
        if (!res.ok) setServer({ status: "error", message: body.error ?? "Couldn't confirm the price." });
        else setServer({ status: "ok", quote: body.quote, signature });
      } catch (err) {
        if ((err as Error).name !== "AbortError") setServer({ status: "error", message: "Couldn't reach the server to confirm the price." });
      }
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [signature]);

  const confirmed = server.status === "ok" && server.signature === signature ? server.quote : null;
  return { quote: confirmed ?? local, confirmed: !!confirmed, server, ready };
}

export type CartQuote = ReturnType<typeof useCartQuote>;
