"use client";
import { motion } from "framer-motion";
import { useState, useTransition } from "react";
import { setShopShippingAction } from "@/app/lightlab/admin/actions";
import { cn } from "@/lib/cn";

/** Shipping on/off for the shop. Off = customers can only pick up (in store or at a market). */
export function ShippingSwitch({ shop, initial }: { shop: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function flip() {
    const next = !on;
    setOn(next);
    setError(null);
    start(async () => {
      const r = await setShopShippingAction(shop, next);
      if (r.error) {
        setOn(!next);
        setError(r.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" role="switch" aria-checked={on} onClick={flip} disabled={pending} className="flex items-center gap-2.5 rounded-full border border-line py-1 pl-1.5 pr-3 text-sm transition-colors hover:border-line-strong disabled:opacity-60">
        <span className={cn("relative h-5 w-9 shrink-0 rounded-full border transition-colors", on ? "border-accent-line bg-accent" : "border-line-strong bg-elev")}>
          <motion.span className={cn("absolute top-[2px] h-3.5 w-3.5 rounded-full", on ? "bg-accent-ink" : "bg-faint")} animate={{ left: on ? 18 : 2 }} transition={{ type: "spring", stiffness: 600, damping: 32 }} />
        </span>
        <span className={on ? "text-fg" : "font-medium text-warning"}>{on ? "Shipping on" : "Pickup only"}</span>
      </button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
