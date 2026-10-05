import "server-only";
import { logError } from "@/lib/api";
import { db } from "@/lib/db";
import { buildEmail, EMAIL_TEMPLATES, type EmailTemplate } from "@/lib/email/build";
import { loadOrderEmailData } from "@/lib/email/data";
import { getMailer, PermanentEmailError, type Mailer } from "@/lib/email/transport";
import { postDiscordNewOrder } from "./discord";

/**
 * Durable notification queue. Jobs are written in the same transaction as
 * the order (or status change), then sent here with retries, so a mail
 * outage delays an email but never loses it or the order.
 */

export const MAX_ATTEMPTS = 8;
/** Minutes to wait after attempt n fails (n = 1, 2, ...). */
const BACKOFF_MIN = [1, 5, 15, 60, 180, 360, 720];
/** A claimed job is locked for this long; if the process dies mid-send it becomes retryable. */
const LEASE_MS = 10 * 60_000;

export function backoffMs(attempts: number) {
  return BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)] * 60_000;
}

type Payload = { orderId: string; note?: string | null };

let running: Promise<ProcessResult> | null = null;
export type ProcessResult = { sent: number; failed: number; retrying: number };

/** Sends due jobs. Overlapping calls in one process share a single run. */
export function processOutbox(opts: { limit?: number; mailer?: Mailer; now?: Date } = {}): Promise<ProcessResult> {
  running ??= run(opts).finally(() => {
    running = null;
  });
  return running;
}

async function run({ limit = 25, mailer, now = new Date() }: { limit?: number; mailer?: Mailer; now?: Date }): Promise<ProcessResult> {
  const result: ProcessResult = { sent: 0, failed: 0, retrying: 0 };
  const due = await db.outboxJob.findMany({
    where: { status: { in: ["PENDING", "SENDING"] }, nextAttemptAt: { lte: now } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const job of due) {
    // Claim with a conditional update so two workers can never send the same job.
    const claimed = await db.outboxJob.updateMany({
      where: { id: job.id, status: { in: ["PENDING", "SENDING"] }, nextAttemptAt: { lte: now } },
      data: { status: "SENDING", attempts: { increment: 1 }, nextAttemptAt: new Date(now.getTime() + LEASE_MS) },
    });
    if (claimed.count !== 1) continue;
    const attempts = job.attempts + 1;

    try {
      await deliver(job.kind, job.template, JSON.parse(job.payload) as Payload, job.id, mailer);
      await db.outboxJob.update({ where: { id: job.id }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
      result.sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const permanent = err instanceof PermanentEmailError || err instanceof UnknownJobError;
      if (permanent || attempts >= MAX_ATTEMPTS) {
        await db.outboxJob.update({ where: { id: job.id }, data: { status: "FAILED", lastError: message.slice(0, 1000) } });
        logError(`outbox:${job.template}:gave-up`, err);
        result.failed++;
      } else {
        await db.outboxJob.update({
          where: { id: job.id },
          data: { status: "PENDING", lastError: message.slice(0, 1000), nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)) },
        });
        logError(`outbox:${job.template}:attempt-${attempts}`, err);
        result.retrying++;
      }
    }
  }
  return result;
}

class UnknownJobError extends Error {}

async function deliver(kind: string, template: string, payload: Payload, jobId: string, mailer?: Mailer) {
  const data = await loadOrderEmailData(payload.orderId);
  if (!data) throw new UnknownJobError(`Order ${payload.orderId} not found`);

  if (kind === "discord") {
    if (template !== "discord-new-order") throw new UnknownJobError(`Unknown Discord template ${template}`);
    return postDiscordNewOrder(data);
  }
  if (kind === "email" && (EMAIL_TEMPLATES as readonly string[]).includes(template)) {
    const email = await buildEmail(template as EmailTemplate, data, { note: payload.note });
    return (mailer ?? getMailer()).send(email, jobId);
  }
  throw new UnknownJobError(`Unknown job ${kind}/${template}`);
}

/** Retry a failed job now (used by the admin dashboard). */
export async function retryJob(id: string) {
  await db.outboxJob.update({ where: { id }, data: { status: "PENDING", nextAttemptAt: new Date(), attempts: 0 } });
}
