"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import { uploads } from "@config/site";
import { useConfig } from "@/components/ConfigProvider";
import { cn } from "@/lib/cn";
import { useOrder } from "@/lib/order/store";

/** Drag-and-drop zone. Pulses and tilts while a file is dragged over it. */
export function Dropzone({ compact = false }: { compact?: boolean }) {
  const cfg = useConfig();
  const addFiles = useOrder((s) => s.addFiles);
  const rejected = useOrder((s) => s.rejected);
  const dismiss = useOrder((s) => s.dismissRejected);
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  function take(list: FileList | null) {
    if (list?.length) addFiles(Array.from(list), cfg);
  }

  return (
    <div>
      <motion.div
        role="button"
        tabIndex={0}
        aria-label={`Upload STL or 3MF files, up to ${uploads.maxFileMb} MB each`}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current?.click())}
        onDragEnter={(e) => {
          e.preventDefault();
          depth.current++;
          setOver(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          depth.current--;
          if (depth.current <= 0) setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          depth.current = 0;
          setOver(false);
          take(e.dataTransfer.files);
        }}
        animate={{ scale: over ? 1.015 : 1, rotate: over ? -0.4 : 0 }}
        whileHover={{ scale: over ? 1.015 : 1.004 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed text-center outline-none transition-colors",
          over ? "border-accent-line bg-accent-soft" : "border-line-strong bg-surface hover:border-accent-line",
          compact ? "px-5 py-4" : "px-6 py-16 sm:py-24",
        )}
      >
        <AnimatePresence>
          {over && (
            <motion.div
              className="pointer-events-none absolute inset-3 rounded-2xl border-2 border-accent-line"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: [0.2, 0.9, 0.2], scale: [0.98, 1, 0.98] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, repeat: Infinity }}
            />
          )}
        </AnimatePresence>

        <div className={cn("relative flex items-center justify-center", compact ? "flex-row gap-4" : "flex-col gap-6")}>
          <motion.div
            animate={over ? { y: [-5, 5, -5], rotate: [-4, 4, -4] } : { y: 0, rotate: 0 }}
            transition={over ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" } : {}}
            className={cn("grid place-items-center rounded-full bg-accent text-accent-ink", compact ? "h-10 w-10" : "h-16 w-16")}
          >
            <svg width={compact ? 20 : 30} height={compact ? 20 : 30} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
            </svg>
          </motion.div>
          <div className={compact ? "text-left" : ""}>
            <p className={cn("font-display font-semibold text-fg", compact ? "text-sm" : "text-xl sm:text-2xl")}>
              {over ? "Drop to upload" : compact ? "Add more files" : "Drag your .stl or .3mf files here"}
            </p>
            <p className={cn("text-muted", compact ? "text-xs" : "mt-1 text-sm")}>
              or <span className="font-medium text-accent-text underline underline-offset-4">choose files</span> · up to {uploads.maxFileMb} MB each
            </p>
          </div>
        </div>
        <input
          ref={input}
          type="file"
          accept=".stl,.3mf,model/stl,model/3mf,application/sla,application/vnd.ms-pki.stl,application/vnd.ms-package.3dmanufacturing-3dmodel+xml"
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            take(e.target.files);
            e.target.value = "";
          }}
        />
      </motion.div>

      <AnimatePresence>
        {rejected.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 overflow-hidden" role="alert">
            <div className="flex items-start justify-between gap-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              <ul className="space-y-0.5">
                {rejected.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <button type="button" onClick={dismiss} className="text-xs underline" aria-label="Dismiss upload errors">
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
