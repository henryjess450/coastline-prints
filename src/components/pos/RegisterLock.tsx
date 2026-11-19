"use client";
import { motion } from "framer-motion";
import { logoutAction } from "@/app/admin/actions";
import { cn } from "@/lib/cn";

export type LockMode = "off" | "set" | "again" | "locked";
export type LockState = { mode: LockMode; pin: string; first: string; error: string | null };

export const LOCK_TITLES: Record<Exclude<LockMode, "off">, string> = { set: "Pick a 4-digit PIN", again: "Type it again", locked: "Register locked" };

/**
 * Covers the whole register while it's locked (or while a PIN is being
 * picked). Type the PIN here or on the Stream Deck. "Forgot the PIN" logs
 * out of the admin, so getting back in takes the admin password.
 */
export function RegisterLock({ lock, onKey, onCancel, onForgot }: { lock: LockState; onKey: (k: string) => void; onCancel: () => void; onForgot: () => void }) {
  if (lock.mode === "off") return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#0a0a0a] p-6 text-[#f5f5f5]">
      <div className="w-full max-w-xs text-center">
        <p className="font-display text-3xl font-bold">{LOCK_TITLES[lock.mode]}</p>
        <p className={cn("mt-2 h-5 text-sm", lock.error ? "text-danger" : "text-[#a3a3a3]")}>{lock.error ?? (lock.mode === "locked" ? "Type the PIN to unlock" : "Used to unlock this register")}</p>
        <motion.div key={lock.error ?? "ok"} animate={lock.error ? { x: [0, -8, 8, -4, 0] } : {}} className="my-6 flex justify-center gap-4">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn("h-4 w-4 rounded-full border-2 border-[#f5f5f5]", i < lock.pin.length && "bg-[#f5f5f5]")} />
          ))}
        </motion.div>
        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <PadKey key={d} label={d} onClick={() => onKey(d)} />
          ))}
          <PadKey label="⌫" onClick={() => onKey("back")} aria="Delete" />
          <PadKey label="0" onClick={() => onKey("0")} />
          <span />
        </div>
        <div className="mt-6 text-sm text-[#a3a3a3]">
          {lock.mode === "locked" ? (
            <button
              type="button"
              className="underline underline-offset-4 hover:text-[#f5f5f5]"
              onClick={async () => {
                onForgot();
                await logoutAction();
              }}
            >
              Forgot the PIN? Log out
            </button>
          ) : (
            <button type="button" className="underline underline-offset-4 hover:text-[#f5f5f5]" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PadKey({ label, onClick, aria }: { label: string; onClick: () => void; aria?: string }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={onClick} aria-label={aria ?? label} className="h-16 rounded-2xl border border-[#3d3d3d] bg-[#1c1c1c] font-display text-2xl font-bold hover:border-[#f5f5f5]">
      {label}
    </motion.button>
  );
}
