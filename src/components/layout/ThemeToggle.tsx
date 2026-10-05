"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useSyncExternalStore } from "react";
import { buttonClass } from "@/components/ui/Button";

type Theme = "dark" | "light";

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => null);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    // Read by the server on the next request so pages render in this theme.
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  const isLight = theme === "light";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      className={buttonClass("secondary", "sm", "w-10 px-0")}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.svg
          key={isLight ? "sun" : "moon"}
          initial={{ opacity: 0, rotate: -120, scale: 0.4 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 120, scale: 0.4 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden
        >
          {isLight ? (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </>
          ) : (
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          )}
        </motion.svg>
      </AnimatePresence>
    </button>
  );
}

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}
