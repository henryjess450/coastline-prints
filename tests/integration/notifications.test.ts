import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { buildEmail, EMAIL_TEMPLATES } from "@/lib/email/build";
import { loadOrderEmailData } from "@/lib/email/data";
import { PermanentEmailError, type Mailer, type OutgoingEmail } from "@/lib/email/transport";
import { backoffMs, MAX_ATTEMPTS, processOutbox } from "@/lib/notify/outbox";
import { createPaidOrder } from "../helpers/fixtures";


function fakeMailer(behaviour: (e: OutgoingEmail) => void = () => {}) {
  const sent: OutgoingEmail[] = [];
  const mailer: Mailer = {
    mode: "preview",
    async send(e) {
      behaviour(e);
      sent.push(e);
    },
  };
  return { mailer, sent };
}

beforeEach(async () => {
  await db.outboxJob.deleteMany();
});

describe("email templates", () => {
  it("customer receipt has the essentials, including pickup address", async () => {
    const order = await createPaidOrder();
    const d = (await loadOrderEmailData(order.id))!;
    const e = await buildEmail("customer-receipt", d);
    expect(e.to).toBe("sam@example.com");
    expect(e.replyTo).toBe("owner@coastline.test");
    expect(e.subject).toContain(order.orderNumber);
    for (const s of [order.orderNumber, "123 Example Street", "Saturday, October 10, 5 to 6 pm", "Visa ending 4242", "Total paid (CAD)", "/status?order=", "squareup.com/receipt", "What happens next"]) {
      expect(e.html).toContain(s);
    }
    expect(e.text).toContain("123 Example Street");
  });

  it("owner email goes to the owner with full job details and an admin link", async () => {
    const order = await createPaidOrder();
    const e = await buildEmail("owner-new-order", (await loadOrderEmailData(order.id))!);
    expect(e.to).toBe("owner@coastline.test");
    expect(e.replyTo).toBe("sam@example.com");
    for (const s of ["Sam Rivers", "604 555 0123", "Saturday, October 10, 5 to 6 pm", "Bambu Lab A1 Mini", "Please print it blue side up", `/admin/orders/${order.id}`, "20.0 × 20.0 × 20.0 mm", " g "]) {
      expect(e.html).toContain(s);
    }
  });

  it("ready-for-pickup includes the address; status updates do not", async () => {
    const order = await createPaidOrder();
    const d = (await loadOrderEmailData(order.id))!;
    expect((await buildEmail("ready-for-pickup", d)).html).toContain("123 Example Street");
    expect((await buildEmail("status-update", d)).html).not.toContain("123 Example Street");
  });

  it("no template contains an em dash", async () => {
    const order = await createPaidOrder();
    const d = (await loadOrderEmailData(order.id))!;
    for (const t of EMAIL_TEMPLATES) {
      const e = await buildEmail(t, d, { note: "Test note" });
      expect(e.html + e.subject, t).not.toMatch(/[—–]/);
    }
  });
});

describe("outbox", () => {
  it("queues receipt + owner email with the order and sends them once", async () => {
    const order = await createPaidOrder();
    const { mailer, sent } = fakeMailer();
    const r = await processOutbox({ mailer });
    expect(r.sent).toBe(2);
    expect(sent.map((e) => e.to).sort()).toEqual(["owner@coastline.test", "sam@example.com"]);
    // Running again sends nothing new.
    expect((await processOutbox({ mailer })).sent).toBe(0);
    const jobs = await db.outboxJob.findMany({ where: { dedupeKey: { startsWith: order.id } } });
    expect(jobs.every((j) => j.status === "SENT" && j.sentAt)).toBe(true);
  });

  it("a mail failure keeps the order and retries with backoff", async () => {
    const order = await createPaidOrder();
    const now = new Date(Date.now() + 1000);
    const down = fakeMailer(() => {
      throw new Error("SMTP connection timed out");
    });
    const r = await processOutbox({ mailer: down.mailer, now });
    expect(r.retrying).toBe(2);
    expect(await db.order.findUnique({ where: { id: order.id } })).not.toBeNull();

    const job = await db.outboxJob.findFirstOrThrow({ where: { template: "customer-receipt" } });
    expect(job.status).toBe("PENDING");
    expect(job.attempts).toBe(1);
    expect(job.lastError).toMatch(/timed out/);
    expect(job.nextAttemptAt.getTime()).toBe(now.getTime() + backoffMs(1));

    // Not due yet: nothing happens.
    const up = fakeMailer();
    expect((await processOutbox({ mailer: up.mailer, now: new Date(now.getTime() + 30_000) })).sent).toBe(0);
    // Due: it goes out.
    expect((await processOutbox({ mailer: up.mailer, now: new Date(now.getTime() + backoffMs(1)) })).sent).toBe(2);
  });

  it("gives up after the maximum attempts", async () => {
    await createPaidOrder();
    await db.outboxJob.updateMany({ data: { attempts: MAX_ATTEMPTS - 1 } });
    const down = fakeMailer(() => {
      throw new Error("still down");
    });
    const r = await processOutbox({ mailer: down.mailer });
    expect(r.failed).toBe(2);
    expect(await db.outboxJob.count({ where: { status: "FAILED" } })).toBe(2);
  });

  it("doesn't retry permanent errors like a rejected address", async () => {
    await createPaidOrder();
    const bad = fakeMailer((e) => {
      if (e.to === "sam@example.com") throw new PermanentEmailError("550 No such user");
    });
    const r = await processOutbox({ mailer: bad.mailer });
    expect(r).toMatchObject({ sent: 1, failed: 1, retrying: 0 });
  });

  it("never double-sends a job that another worker has claimed", async () => {
    await createPaidOrder();
    const lease = new Date(Date.now() + 5 * 60_000);
    await db.outboxJob.updateMany({ data: { status: "SENDING", nextAttemptAt: lease } });
    const { mailer, sent } = fakeMailer();
    await processOutbox({ mailer });
    expect(sent).toHaveLength(0);
  });

  it("concurrent runs share one pass", async () => {
    await createPaidOrder();
    const { mailer, sent } = fakeMailer();
    await Promise.all([processOutbox({ mailer }), processOutbox({ mailer }), processOutbox({ mailer })]);
    expect(sent).toHaveLength(2);
  });
});
