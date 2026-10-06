"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BenchyIcon } from "@/components/brand/Benchy";

/** Signing out: the Benchy waves goodbye and sails off before the page changes. */
export function SignOutButton() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  return (
    <div className="relative inline-flex items-center gap-3">
      <AnimatePresence>
        {leaving && (
          <motion.span className="pointer-events-none absolute -top-10 left-0" initial={{ x: 0, opacity: 1, rotate: 0 }} animate={{ x: 260, opacity: [1, 1, 0], rotate: [0, -6, 4, -4] }} transition={{ duration: 1.3, ease: "easeIn" }} aria-hidden>
            <BenchyIcon size={44} />
          </motion.span>
        )}
      </AnimatePresence>
      <button
        type="button"
        disabled={leaving}
        onClick={async () => {
          setLeaving(true);
          await Promise.all([fetch("/api/account/signout", { method: "POST" }).catch(() => undefined), new Promise((r) => setTimeout(r, 1100))]);
          router.refresh();
        }}
        className="btn btn-secondary h-10 px-4 text-sm"
      >
        {leaving ? "See you soon!" : "Sign out"}
      </button>
    </div>
  );
}
