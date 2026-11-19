"use client";

/*
 * Register lock: one tap (on the Stream Deck or the screen) covers the
 * register with a PIN pad, for stepping away from the stand. The sale in
 * progress stays underneath. Like staff mode, it lives on this device only
 * (the PIN is kept hashed) and other admin pages send it back to the
 * register while it's locked; it isn't a separate login.
 */

const PIN_KEY = "pos:lock-pin";
const LOCKED_KEY = "pos:locked";
const TRIES_KEY = "pos:lock-tries";
/** Wrong PINs in a row before a wait. */
const TRIES = 5;
const WAIT_MS = 60_000;

async function hash(pin: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`coastline-lock:${pin}`));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

export const lockPinSet = () => !!get(PIN_KEY);
export const lockedOn = () => !!get(LOCKED_KEY);

/** Saves a new PIN and locks. */
export async function setPinAndLock(pin: string) {
  localStorage.setItem(PIN_KEY, await hash(pin));
  lockNow();
}

export function lockNow() {
  localStorage.setItem(LOCKED_KEY, "1");
  localStorage.removeItem(TRIES_KEY);
  document.documentElement.dataset.staff = "1";
}

/** "Forgot the PIN": unlocked and no PIN, so the next lock asks for a new one. Used while logging out. */
export function forgetLock() {
  for (const k of [PIN_KEY, LOCKED_KEY, TRIES_KEY]) localStorage.removeItem(k);
}

/** Unlocks if the PIN is right. Returns an error to show, or null when it's unlocked. */
export async function unlock(pin: string, staff: boolean): Promise<string | null> {
  const [count, at] = (get(TRIES_KEY) ?? "0:0").split(":").map(Number);
  if (count >= TRIES && Date.now() - at < WAIT_MS) return "Too many wrong tries. Wait a minute.";
  if ((await hash(pin)) !== get(PIN_KEY)) {
    localStorage.setItem(TRIES_KEY, `${count >= TRIES ? 1 : count + 1}:${Date.now()}`);
    return "Wrong PIN";
  }
  localStorage.removeItem(LOCKED_KEY);
  localStorage.removeItem(TRIES_KEY);
  // Staff mode keeps the admin menu hidden on its own.
  if (!staff) delete document.documentElement.dataset.staff;
  return null;
}
