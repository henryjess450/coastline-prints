"use client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { LiveAnnouncement } from "@/lib/announcements";

const key = (id: string) => `cp-announcement-closed:${id}`;

/** A slim bar across the top of every page. Closing it hides that announcement for good (on this device). */
export function AnnouncementBar({ a }: { a: LiveAnnouncement }) {
  const [open, setOpen] = useState(false);
  // Shown after mount, so a closed one never flashes back.
  useEffect(() => {
    let closed = false;
    try {
      closed = localStorage.getItem(key(a.id)) === "1";
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!closed) setOpen(true);
  }, [a.id]);
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(key(a.id), "1");
    } catch {}
  };
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div role="region" aria-label="Announcement" initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="relative z-40 overflow-hidden bg-accent text-accent-ink">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm sm:px-6">
            <p className="min-w-0 flex-1 text-center">
              {a.message}
              {a.linkUrl && (
                <>
                  {" "}
                  <Link href={a.linkUrl} className="whitespace-nowrap font-semibold underline underline-offset-4">
                    {a.linkLabel || "Learn more"}
                  </Link>
                </>
              )}
            </p>
            <button type="button" onClick={close} aria-label="Close announcement" className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-white/15">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
