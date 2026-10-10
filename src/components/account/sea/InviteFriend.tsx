"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRef, useState, useSyncExternalStore } from "react";
import { bounce, Button } from "@/components/ui/Button";

const noop = () => () => undefined;

/**
 * Invite a friend: their code, big and plain, with one button to copy the
 * link (or share it, on phones). Every friend who has ordered sails in as a
 * little boat, so the fleet grows as they join.
 */
export function InviteFriend({ code, offer, friends, points }: { code: string; offer: string; friends: number; points: number }) {
  // Known only in the browser; the server renders the short path.
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const canShare = useSyncExternalStore(noop, () => typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches, () => false);
  const link = `${origin}/invite/${code}`;
  const [copied, setCopied] = useState(false);
  const copyBtn = useRef<HTMLButtonElement>(null);

  async function copy() {
    await navigator.clipboard?.writeText(link).catch(() => undefined);
    bounce(copyBtn.current);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }
  function share() {
    void navigator.share({ title: "Coastline Prints", text: `Here's ${offer} off your first 3D print order at Coastline Prints.`, url: link }).catch(() => undefined);
  }

  return (
    <div>
      <p className="text-sm text-faint">Your code</p>
      <p className="mt-1 select-all font-mono text-4xl font-bold tracking-[0.12em] text-accent-text sm:text-5xl">{code}</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button ref={copyBtn} onClick={() => void copy()}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={copied ? "y" : "n"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
              {copied ? "Link copied" : "Copy link"}
            </motion.span>
          </AnimatePresence>
        </Button>
        {canShare && (
          <button type="button" onClick={share} className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold transition-[border-color,transform] hover:border-accent-line active:scale-95">
            Share
          </button>
        )}
      </div>

      <div className="mt-8">
        {friends > 0 ? (
          <>
            <Fleet count={friends} />
            <p className="mt-3 text-sm">
              <strong>{friends === 1 ? "1 friend has" : `${friends} friends have`} ordered</strong>
              <span className="text-muted"> · {points} points from invites</span>
            </p>
          </>
        ) : (
          <p className="max-w-xl text-sm text-faint">Each friend who orders sails in here as a little boat.</p>
        )}
      </div>
    </div>
  );
}

/** One small sailboat per friend, bobbing out of step so it looks like water. */
function Fleet({ count }: { count: number }) {
  const reduce = useReducedMotion();
  const shown = Math.min(count, 24);
  return (
    <ul className="flex flex-wrap items-end gap-3" aria-hidden>
      {Array.from({ length: shown }, (_, i) => (
        <motion.li key={i} initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, type: "spring", stiffness: 200, damping: 20 }}>
          {/* Starts and ends level, so the loop never jumps. */}
          <motion.svg width="34" height="30" viewBox="0 0 34 30" animate={reduce ? undefined : { y: [0, -3, 0], rotate: [0, -3, 0] }} transition={{ duration: 2.6, delay: (i % 5) * 0.37, repeat: Infinity, ease: "easeInOut" }}>
            <path d="M17 3 V20 M17 4 L28 19 H17 Z" fill="var(--sand)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="text-accent-text" />
            <path d="M15 7 L7 19 H15 Z" fill="currentColor" className="text-accent-text" />
            <path d="M3 21 H31 L27 27 H7 Z" fill="currentColor" className="text-accent-text" />
          </motion.svg>
        </motion.li>
      ))}
      {count > shown && <li className="pb-1 text-sm text-muted">+{count - shown}</li>}
    </ul>
  );
}
