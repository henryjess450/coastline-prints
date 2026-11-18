"use client";

/*
 * Staff mode: the owner locks this iPad to the register for a helper. The
 * admin menu and the register's settings are hidden, other admin pages send
 * it back to the register, and leaving takes the owner's 4-digit PIN.
 * The lock lives on this device only (the PIN is kept hashed), so it keeps a
 * helper on the register; it isn't a separate login.
 */

const KEY = "pos:staff";
const TRIES_KEY = "pos:staff-tries";
/** Wrong PINs in a row before a wait. */
const TRIES = 5;
const WAIT_MS = 60_000;

async function hash(pin: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`coastline-staff:${pin}`));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function staffOn() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

/** Marks the page, so the admin menu (anything with data-admin-chrome) is hidden. */
export function markStaff(on: boolean) {
  if (on) document.documentElement.dataset.staff = "1";
  else delete document.documentElement.dataset.staff;
}

export async function startStaff(pin: string) {
  localStorage.setItem(KEY, await hash(pin));
  localStorage.removeItem(TRIES_KEY);
  markStaff(true);
}

/** Ends staff mode if the PIN is right. Returns an error to show, or null when it's off. */
export async function endStaff(pin: string): Promise<string | null> {
  const [count, at] = (localStorage.getItem(TRIES_KEY) ?? "0:0").split(":").map(Number);
  if (count >= TRIES && Date.now() - at < WAIT_MS) return "Too many wrong tries. Wait a minute.";
  if ((await hash(pin)) !== localStorage.getItem(KEY)) {
    localStorage.setItem(TRIES_KEY, `${count >= TRIES ? 1 : count + 1}:${Date.now()}`);
    return "That's not the PIN.";
  }
  localStorage.removeItem(KEY);
  localStorage.removeItem(TRIES_KEY);
  markStaff(false);
  return null;
}
