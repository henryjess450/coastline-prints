"use client";
import { animate, AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import QRCode from "qrcode";
import { useEffect, useMemo } from "react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import type { PosLineView } from "@/lib/pos/types";

/** The register and its display are always dark, whatever the site theme is set to. Put back on the way out. */
export function useForceDark() {
  useEffect(() => {
    const html = document.documentElement;
    const was = html.dataset.theme;
    html.dataset.theme = "dark";
    return () => {
      if (was) html.dataset.theme = was;
      else delete html.dataset.theme;
    };
  }, []);
}

/** A crisp QR code drawn as one SVG path (no images, scales to any size). */
export function Qr({ value, className }: { value: string; className?: string }) {
  const { size, d } = useMemo(() => {
    const q = QRCode.create(value, { errorCorrectionLevel: "M" });
    const n = q.modules.size;
    let path = "";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.modules.get(y, x)) path += `M${x} ${y}h1v1h-1z`;
    return { size: n, d: path };
  }, [value]);
  return (
    <svg viewBox={`-2 -2 ${size + 4} ${size + 4}`} className={cn("rounded-2xl bg-white", className)} shapeRendering="crispEdges" role="img" aria-label="QR code">
      <path d={d} fill="#0a0a0a" />
    </svg>
  );
}

/** The little picture beside a line: the product photo, a filament swatch for prints, or a tag for custom items. */
export function Thumb({ line, size = "md" }: { line: Pick<PosLineView, "kind" | "image" | "swatch" | "name">; size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "h-16 w-16 rounded-2xl" : size === "sm" ? "h-10 w-10 rounded-xl" : "h-12 w-12 rounded-xl";
  if (line.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={line.image} alt="" className={cn(box, "shrink-0 bg-surface-strong object-cover")} />;
  }
  if (line.kind === "print") {
    return (
      <span className={cn(box, "grid shrink-0 place-items-center bg-surface-strong")}>
        <svg viewBox="0 0 24 24" className="h-3/5 w-3/5" aria-hidden>
          <path d="M12 2 21 7v10l-9 5-9-5V7z" fill={line.swatch ?? "#888"} />
          <path d="M12 12 21 7M12 12 3 7M12 12v10" stroke="rgb(0 0 0 / 0.35)" strokeWidth="1.2" fill="none" />
        </svg>
      </span>
    );
  }
  return (
    <span className={cn(box, "grid shrink-0 place-items-center bg-accent-soft font-display text-lg font-bold text-accent-text")} aria-hidden>
      {line.name.trim().charAt(0).toUpperCase() || "+"}
    </span>
  );
}

/** Money that counts up or down to its new value instead of jumping. */
export function AnimatedMoney({ cents, className }: { cents: number; className?: string }) {
  const value = useMotionValue(cents);
  const text = useTransform(value, (v) => money(Math.round(v)));
  useEffect(() => {
    const c = animate(value, cents, { duration: 0.45, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [cents, value]);
  return <motion.span className={cn("tabular-nums", className)}>{text}</motion.span>;
}

/** A dark popup card over a dimmed backdrop. Tapping outside closes it when `onClose` is given. */
export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose?: () => void; title?: React.ReactNode; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode }) {
  useEffect(() => {
    if (!open || !onClose) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[300] flex items-end justify-center p-3 sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal
            initial={{ opacity: 0, y: 40, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className={cn("relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-[28px] border border-line bg-elev shadow-2xl", wide ? "max-w-2xl" : "max-w-md")}
          >
            {(title || onClose) && (
              <div className="flex items-center justify-between gap-3 px-6 pt-5">
                <h2 className="font-display text-xl font-bold">{title}</h2>
                {onClose && (
                  <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-surface text-muted transition-colors hover:text-fg">
                    ✕
                  </button>
                )}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">{children}</div>
            {footer && <div className="border-t border-line px-6 py-4">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** A tick that draws itself in. */
export function DrawnCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 52 52" className={className} aria-hidden>
      <motion.circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: "easeOut" }} />
      <motion.path d="M15 27l7 7 15-16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.4, ease: "easeOut" }} />
    </svg>
  );
}
