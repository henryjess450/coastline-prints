/** Admin tools: invites, emails to customers, announcements, sales. */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

const { db } = await import("@/lib/db");
const { createInvitedAccount } = await import("@/lib/account/auth");
const { queueBroadcast, buildBroadcastEmail, buildInviteEmail, unsubscribeUrl, unsubscribeTokenOk } = await import("@/lib/broadcast");
const { liveAnnouncement, clearAnnouncementCache } = await import("@/lib/announcements");
const { liveSale } = await import("@/lib/sales");
const { saveSeason, getSeason } = await import("@/lib/season");

const email = () => `${randomUUID().slice(0, 8)}@example.com`;

describe("inviting customers", () => {
  it("makes the account once, and the welcome email says how to sign in", async () => {
    const e = email();
    const c = await createInvitedAccount(`  ${e.toUpperCase()} `, "Robin Park");
    expect(c).toMatchObject({ email: e, name: "Robin Park" });
    expect(c!.invitedAt).toBeInstanceOf(Date);
    expect(await createInvitedAccount(e, null)).toBeNull();
    const mail = (await buildInviteEmail(c!.id, "Thanks for the order at the market!"))!;
    expect(mail.to).toBe(e);
    expect(mail.html).toContain("Hi Robin");
    expect(mail.html).toContain("Thanks for the order at the market!");
  });
});

describe("emails to customers", () => {
  it("only goes to people who haven't unsubscribed, each with their own unsubscribe link", async () => {
    const yes = await db.customer.create({ data: { email: email() } });
    const no = await db.customer.create({ data: { email: email(), emailOptOut: true } });
    const { id } = await queueBroadcast({ subject: "Sale on", heading: "Sale on", body: "Hi.\n\nIt's on.", code: "BOXINGDAY" });
    const jobs = await db.outboxJob.findMany({ where: { dedupeKey: { startsWith: `broadcast:${id}:` } } });
    expect(jobs.some((j) => j.dedupeKey!.endsWith(yes.id))).toBe(true);
    expect(jobs.some((j) => j.dedupeKey!.endsWith(no.id))).toBe(false);

    const mail = (await buildBroadcastEmail(id, yes.id))!;
    expect(mail.html).toContain("BOXINGDAY");
    expect(mail.html).toContain(unsubscribeUrl(yes.id).replace(/&/g, "&amp;"));
    // Unsubscribed after it was queued: skipped.
    await db.customer.update({ where: { id: yes.id }, data: { emailOptOut: true } });
    expect(await buildBroadcastEmail(id, yes.id)).toBeNull();
  });

  it("checks unsubscribe links", () => {
    const url = new URL(unsubscribeUrl("abc123"));
    expect(unsubscribeTokenOk("abc123", url.searchParams.get("t")!)).toBe(true);
    expect(unsubscribeTokenOk("abc124", url.searchParams.get("t")!)).toBe(false);
    expect(unsubscribeTokenOk("abc123", "nope")).toBe(false);
  });
});

describe("announcements and sales", () => {
  it("shows an announcement only between its dates", async () => {
    await db.announcement.updateMany({ data: { active: false } });
    const day = 86_400_000;
    const now = Date.now();
    await db.announcement.create({ data: { message: "Later", startsAt: new Date(now + day) } });
    await db.announcement.create({ data: { message: "Over", endsAt: new Date(now - day) } });
    clearAnnouncementCache();
    expect(await liveAnnouncement()).toBeNull();
    await db.announcement.create({ data: { message: "Closed Dec 24 to 27", endsAt: new Date(now + day) } });
    clearAnnouncementCache();
    expect((await liveAnnouncement())?.message).toBe("Closed Dec 24 to 27");
    await db.announcement.updateMany({ data: { active: false } });
    clearAnnouncementCache();
  });

  it("runs a sale between its dates, the biggest one if two overlap", async () => {
    const at = new Date("2031-11-28T12:00:00Z");
    await db.sale.create({ data: { name: "Small", percentOff: 10, startsAt: new Date("2031-11-27T00:00:00Z"), endsAt: new Date("2031-12-02T00:00:00Z") } });
    await db.sale.create({ data: { name: "Black Friday", percentOff: 20, startsAt: new Date("2031-11-28T00:00:00Z"), endsAt: new Date("2031-11-29T00:00:00Z") } });
    expect((await liveSale(at))?.name).toBe("Black Friday");
    expect((await liveSale(new Date("2031-11-30T12:00:00Z")))?.name).toBe("Small");
    expect(await liveSale(new Date("2031-12-05T00:00:00Z"))).toBeNull();
  });

  it("switches the site theme and back to blue", async () => {
    expect((await saveSeason("christmas")).falling).toBe("snow");
    expect((await getSeason()).id).toBe("christmas");
    await saveSeason("coastline");
    expect((await getSeason()).id).toBe("coastline");
    await expect(saveSeason("nope")).rejects.toThrow();
  });
});
