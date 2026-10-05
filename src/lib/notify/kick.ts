import "server-only";
import { after } from "next/server";
import { logError } from "@/lib/api";
import { processOutbox } from "./outbox";

/**
 * Send queued notifications after the response has gone out. Never throws:
 * a problem here must not turn a successful payment into an error. If it
 * doesn't run, the background worker/cron picks the jobs up anyway.
 */
export function sendNotificationsSoon(scope: string) {
  const task = () => processOutbox().then(() => undefined, (e) => logError(`outbox:${scope}`, e));
  try {
    after(task);
  } catch {
    void task(); // outside a request (scripts, tests)
  }
}
