"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useConfig } from "@/components/ConfigProvider";
import { ProgressRing } from "@/components/motion/ProgressRing";
import { cn } from "@/lib/cn";
import { bytes } from "@/lib/format";
import { deriveItem } from "@/lib/order/derive";
import { useOrder, type CartItem } from "@/lib/order/store";

export function CartList() {
  const items = useOrder((s) => s.items);
  const selectedKey = useOrder((s) => s.selectedKey);
  const select = useOrder((s) => s.select);
  const remove = useOrder((s) => s.remove);

  return (
    <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" aria-label="Files in this order">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.li
            key={item.key}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="min-w-[240px] lg:min-w-0"
          >
            <div
              className={cn(
                "group flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left transition-colors",
                item.key === selectedKey ? "border-accent-line bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
              )}
            >
              <button
                type="button"
                onClick={() => select(item.key)}
                aria-pressed={item.key === selectedKey}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <StatusIcon item={item} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{item.fileName}</span>
                  <span className="block truncate text-xs text-muted">
                    <StatusText item={item} />
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => remove(item.key)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-faint transition-colors hover:bg-danger/15 hover:text-danger"
                aria-label={`Remove ${item.fileName}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function StatusIcon({ item }: { item: CartItem }) {
  const cfg = useConfig();
  if (item.phase === "error")
    return <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-danger/15 font-bold text-danger" aria-hidden>!</span>;
  if (item.phase !== "ready") return <ProgressRing value={item.phase === "parsing" ? 0.05 : item.uploadProgress} label={`Uploading ${item.fileName}`} />;
  const d = deriveItem(item, cfg);
  const ok = d.assignment?.ok;
  return (
    <motion.span
      initial={{ scale: 0.4, rotate: -30 }}
      animate={{ scale: 1, rotate: 0 }}
      className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-lg font-bold", ok ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}
      aria-hidden
    >
      {ok ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
      ) : (
        "!"
      )}
    </motion.span>
  );
}

function StatusText({ item }: { item: CartItem }) {
  const cfg = useConfig();
  if (item.phase === "error") return <span className="text-danger">{item.error}</span>;
  if (item.phase === "parsing") return <>Checking the model…</>;
  if (item.phase === "uploading") return <>Uploading · {bytes(item.fileSize)}</>;
  const d = deriveItem(item, cfg);
  if (!d.size) return null;
  const dims = `${d.size.x.toFixed(0)}×${d.size.y.toFixed(0)}×${d.size.z.toFixed(0)} mm`;
  if (d.assignment?.ok) return <>{dims} · {d.assignment.printer.shortName}</>;
  return <span className="text-warning">{dims} · too large</span>;
}
