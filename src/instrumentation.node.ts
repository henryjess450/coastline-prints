import { cleanupFiles } from "@/lib/cleanup";
import { processOutbox } from "@/lib/notify/outbox";

const INTERVAL_MS = 60_000;
const g = globalThis as unknown as { __outboxTimer?: NodeJS.Timeout; __cleanupTimer?: NodeJS.Timeout };

const tick = () => processOutbox().catch((err) => console.error("[outbox:interval]", err));

// Guard against double-starting in dev hot reloads.
if (!g.__outboxTimer) {
  setTimeout(tick, 5_000).unref?.(); // catch up on anything queued while the server was down
  g.__outboxTimer = setInterval(tick, INTERVAL_MS);
  g.__outboxTimer.unref?.();
}

// File retention cleanup: shortly after start, then once a day.
if (!g.__cleanupTimer) {
  const clean = () => cleanupFiles().catch((err) => console.error("[cleanup]", err));
  setTimeout(clean, 60_000).unref?.();
  g.__cleanupTimer = setInterval(clean, 24 * 60 * 60_000);
  g.__cleanupTimer.unref?.();
}
