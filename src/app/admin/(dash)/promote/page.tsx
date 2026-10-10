import Link from "next/link";
import { createAnnouncementAction, createSaleAction, endAnnouncementAction, endSaleAction, sendBroadcastAction } from "@/app/admin/tools-actions";
import { area, field, Field, ToolForm } from "@/components/admin/ToolForm";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/admin/auth";
import { adminClock } from "@/lib/admin/cards";
import { broadcastAudience } from "@/lib/broadcast";
import { formatCardNumber } from "@/lib/codes/apply";
import { db } from "@/lib/db";
import { money } from "@/lib/format";

export const metadata = { title: "Promote" };

const day = (d: Date) => d.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "America/Vancouver" });

/** Announcements across the site, site-wide sales, and emails to customers (news or a coupon). */
export default async function PromotePage() {
  await requireAdmin();
  const { now } = adminClock();
  const [announcements, sales, broadcasts, coupons, audience] = await Promise.all([
    db.announcement.findMany({ where: { active: true, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, orderBy: { createdAt: "desc" } }),
    db.sale.findMany({ where: { active: true, endsAt: { gt: now } }, orderBy: { startsAt: "asc" } }),
    db.broadcast.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    // Coupons anyone can use: not gift cards, not locked to an account, not someone's invite code.
    db.promoCode.findMany({ where: { active: true, kind: { not: "GIFT_CARD" }, ownerId: null, referrerId: null, rewardOrderId: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, orderBy: { createdAt: "desc" }, take: 50 }),
    broadcastAudience(),
  ]);
  const live = (s: { startsAt: Date | null }) => !s.startsAt || s.startsAt <= now;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Promote</h1>
        <p className="text-sm text-muted">Tell people what&apos;s new, run a sale, or email everyone a coupon. For holiday decorations, see Settings &gt; Site theme.</p>
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold">Announcement bar</h2>
        <p className="mt-1 text-sm text-muted">A slim bar across the top of every page, like &quot;Closed Dec 24 to 27&quot;. People can close it.</p>
        {announcements.length > 0 && (
          <ul className="mt-4 space-y-2">
            {announcements.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="mr-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold uppercase text-accent-ink">{live(a) ? "Showing" : `From ${day(a.startsAt!)}`}</span>
                  {a.message}
                  {a.endsAt && <span className="text-muted"> · until {day(a.endsAt)}</span>}
                </span>
                <form action={endAnnouncementAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="text-sm text-danger hover:underline">
                    Take it down
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <ToolForm action={createAnnouncementAction} submit="Put it up" className="mt-5">
          <Field label="Message">
            <input name="message" required maxLength={240} placeholder="Holiday hours: closed Dec 24 to 27. Orders pick up again on the 28th." className={field} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Link (optional)" hint="/gift-cards, or https://…">
              <input name="linkUrl" className={field} />
            </Field>
            <Field label="Link text">
              <input name="linkLabel" placeholder="Learn more" maxLength={40} className={field} />
            </Field>
            <Field label="Starts (optional)">
              <input name="startsAt" type="date" className={field} />
            </Field>
            <Field label="Ends (optional)">
              <input name="endsAt" type="date" className={field} />
            </Field>
          </div>
        </ToolForm>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold">Site-wide sale</h2>
        <p className="mt-1 text-sm text-muted">A percentage off the prints on every order between two dates, taken off at checkout by itself. Shipping isn&apos;t discounted. A coupon still works on top, on what&apos;s left.</p>
        {sales.length > 0 && (
          <ul className="mt-4 space-y-2">
            {sales.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm">
                <span>
                  <span className="mr-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold uppercase text-accent-ink">{s.startsAt <= now ? "On now" : "Coming up"}</span>
                  <strong>{s.name}</strong>: {s.percentOff}% off, {day(s.startsAt)} to {day(s.endsAt)}
                </span>
                <form action={endSaleAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <button type="submit" className="text-sm text-danger hover:underline">
                    End it
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <ToolForm action={createSaleAction} submit="Save the sale" className="mt-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Name" hint="Shown at checkout.">
              <input name="name" required maxLength={60} placeholder="Boxing Day" className={field} />
            </Field>
            <Field label="Percent off">
              <input name="percentOff" type="number" min={1} max={90} required placeholder="15" className={field} />
            </Field>
            <Field label="Starts">
              <input name="startsAt" type="date" required className={field} />
            </Field>
            <Field label="Ends">
              <input name="endsAt" type="date" required className={field} />
            </Field>
          </div>
        </ToolForm>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold">Email your customers</h2>
        <p className="mt-1 text-sm text-muted">
          Goes to the {audience.length} {audience.length === 1 ? "person" : "people"} with an account who haven&apos;t unsubscribed. Every email has an unsubscribe link. To email a coupon, make it in{" "}
          <Link href="/admin/codes" className="text-accent-text underline">
            Codes
          </Link>{" "}
          first (like BOXINGDAY, with a use limit and end date), then pick it here.
        </p>
        <ToolForm action={sendBroadcastAction} submit="Send it" pending="Sending…" className="mt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Subject">
              <input name="subject" required maxLength={120} placeholder="15% off everything this weekend" className={field} />
            </Field>
            <Field label="Heading in the email (optional)" hint="Uses the subject if blank.">
              <input name="heading" maxLength={120} className={field} />
            </Field>
          </div>
          <Field label="Message" hint="A blank line starts a new paragraph.">
            <textarea name="body" required rows={5} maxLength={4000} className={area} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Coupon to include (optional)">
              <select name="codeId" className={field} defaultValue="">
                <option value="">No coupon</option>
                {coupons.map((c) => (
                  <option key={c.id} value={c.id}>
                    {formatCardNumber(c.code)} · {c.kind === "PERCENT" ? `${c.percentOff}% off` : `${money(c.amountCents ?? 0)} off`}
                    {c.maxUses ? ` · ${c.maxUses - c.uses} left` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Button link (optional)" hint="/order, or https://…">
              <input name="linkUrl" className={field} />
            </Field>
            <Field label="Button text">
              <input name="linkLabel" placeholder="Start an order" maxLength={40} className={field} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirm" className="h-4 w-4 accent-[var(--accent)]" /> It&apos;s ready: send it to {audience.length} {audience.length === 1 ? "person" : "people"}
          </label>
        </ToolForm>
        {broadcasts.length > 0 && (
          <div className="mt-6 border-t border-line pt-4">
            <h3 className="text-sm font-semibold text-muted">Sent before</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {broadcasts.map((b) => (
                <li key={b.id} className="flex justify-between gap-3">
                  <span className="truncate">
                    {b.subject}
                    {b.code && <span className="text-faint"> · {b.code}</span>}
                  </span>
                  <span className="shrink-0 text-faint">
                    {day(b.createdAt)} · {b.sentCount}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
