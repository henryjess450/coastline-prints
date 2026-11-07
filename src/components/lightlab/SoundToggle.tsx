"use client";
import { setSoundOn, useSoundOn } from "@/lib/feel";

/** Little sounds on or off (off unless the shopper turns them on). */
export function SoundToggle() {
  const on = useSoundOn();
  return (
    <button type="button" onClick={() => setSoundOn(!on)} aria-pressed={on} className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:text-fg active:scale-95">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        {on ? (
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </>
        ) : (
          <path d="m22 9-6 6M16 9l6 6" />
        )}
      </svg>
      {on ? "Sounds on" : "Sounds off"}
    </button>
  );
}
