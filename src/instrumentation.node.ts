import { cleanupFiles } from "@/lib/cleanup";
import { processOutbox } from "@/lib/notify/outbox";
import { checkInbox, etransferSettings, expireEtransfers, hasWaitingEtransfers } from "@/lib/payments/etransfer.server";

const INTERVAL_MS = 60_000;
const g = globalThis as unknown as { __outboxTimer?: NodeJS.Timeout; __cleanupTimer?: NodeJS.Timeout; __etransferTimer?: NodeJS.Timeout };

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

// e-Transfers: read the inbox every minute while someone is waiting to pay, otherwise every 10
// (to catch late payments), and cancel unpaid ones whose time is up.
if (!g.__etransferTimer && etransferSettings()) {
  let ticks = 0;
  const run = async () => {
    ticks++;
    try {
      if ((await hasWaitingEtransfers()) || ticks % 10 === 0) await checkInbox({ minGapMs: 30_000 });
      await expireEtransfers();
    } catch (err) {
      console.error("[etransfer]", err);
    }
  };
  setTimeout(run, 20_000).unref?.();
  g.__etransferTimer = setInterval(run, 60_000);
  g.__etransferTimer.unref?.();
}
