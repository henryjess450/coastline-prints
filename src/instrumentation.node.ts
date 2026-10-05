import { processOutbox } from "@/lib/notify/outbox";

const INTERVAL_MS = 60_000;
const g = globalThis as unknown as { __outboxTimer?: NodeJS.Timeout };

const tick = () => processOutbox().catch((err) => console.error("[outbox:interval]", err));

// Guard against double-starting in dev hot reloads.
if (!g.__outboxTimer) {
  setTimeout(tick, 5_000).unref?.(); // catch up on anything queued while the server was down
  g.__outboxTimer = setInterval(tick, INTERVAL_MS);
  g.__outboxTimer.unref?.();
}
