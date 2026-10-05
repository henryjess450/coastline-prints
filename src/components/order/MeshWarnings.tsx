"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useOrder, type CartItem } from "@/lib/order/store";

export function MeshWarnings({ item }: { item: CartItem }) {
  const toggleInches = useOrder((s) => s.toggleInches);
  const warnings = (item.upload?.warnings ?? item.analysis?.warnings ?? []).filter(
    // Once the inches fix is applied, that warning no longer applies.
    (w) => !(item.unitFactor !== 1 && (w.code === "likely-inches" || w.code === "too-small")),
  );

  return (
    <AnimatePresence initial={false}>
      {warnings.map((w) => (
        <motion.div
          key={w.code}
          layout
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div
            role={w.severity === "error" ? "alert" : "status"}
            className={cn(
              "mb-2 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 text-sm",
              w.severity === "error" && "border-danger/35 bg-danger/10 text-danger",
              w.severity === "warning" && "border-warning/35 bg-warning/10 text-fg",
              w.severity === "info" && "border-line bg-surface text-muted",
            )}
          >
            <span className="flex-1">{w.message}</span>
            {w.code === "likely-inches" && (
              <Button size="sm" onClick={() => toggleInches(item.key)}>
                Convert inches to mm (×25.4)
              </Button>
            )}
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
