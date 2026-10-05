/**
 * Runs once when the server starts. On a long-running Node server (VPS,
 * `next start`) this starts the notification worker. On serverless hosts,
 * use the /api/cron/outbox endpoint instead and set OUTBOX_WORKER=off.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.OUTBOX_WORKER !== "off") {
    await import("./instrumentation.node");
  }
}
