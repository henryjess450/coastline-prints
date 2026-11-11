import "server-only";
import { render, toPlainText } from "@react-email/render";
import { lightlab } from "@config/lightlab";
import { privateSite } from "@config/private.server";
import { accentFor, EmailLayout, H1, P, PillButton } from "@/emails/components/Layout";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email/data";
import type { OutgoingEmail } from "@/lib/email/transport";
import { clock, dayParts, mapsUrl } from "./markets";

export const HOLD_EMAILS = ["stand-hold-customer", "stand-hold-owner"] as const;
export type HoldEmail = (typeof HOLD_EMAILS)[number];

/** The customer's "it's held" email, and the owner's heads-up. Null if the hold or market is gone (skipped). */
export async function buildHoldEmail(template: HoldEmail, holdId: string): Promise<OutgoingEmail | null> {
  const h = await db.standHold.findUnique({ where: { id: holdId } });
  const m = h ? await db.market.findUnique({ where: { id: h.marketId } }) : null;
  if (!h || !m) return null;
  const day = dayParts(m.date).long;
  const window = `${clock(h.slotStart)} to ${clock(h.slotEnd)}`;
  const what = `${h.quantity > 1 ? `${h.quantity} × ` : ""}${h.label}`;
  const accent = accentFor(true);

  if (template === "stand-hold-owner") {
    const subject = `Hold: ${what} for ${h.name}, ${window}`;
    const html = await render(
      <EmailLayout brand="lightlab" preview={subject} footerNote="LightLab stand hold. Not sent to customers.">
        <H1>Set one aside</H1>
        <P>
          {h.name} is holding {what} at {m.name} and will come by {window}. They pay at the stand.
        </P>
        <P muted>{[h.email, h.phone].filter(Boolean).join(" · ")}</P>
        <PillButton accent={accent} href={`${appUrl()}/lightlab/admin/markets/${m.id}/pack`}>
          See today&apos;s holds
        </PillButton>
      </EmailLayout>,
    );
    return { to: privateSite.ownerEmail, replyTo: h.email, subject, html, text: toPlainText(html) };
  }

  const subject = `Held for you: ${h.label} at ${m.name}`;
  const where = [m.place, m.address].filter(Boolean).join(", ");
  const html = await render(
    <EmailLayout brand="lightlab" preview={`Come by ${window}. Pay at the stand.`} footerNote={`${lightlab.name}. You held a lamp at our market stand.`}>
      <H1>It&apos;s held for you, {h.name.split(/\s+/)[0]}!</H1>
      <P>
        {what}, at the LightLab stand at <strong>{m.name}</strong>
        {where ? `, ${where}` : ""}.
      </P>
      <P>
        <strong>
          {day}, {window}
        </strong>
      </P>
      <P muted>Pay at the stand by card, cash or e-Transfer. We&apos;ll hold it until {clock(h.slotEnd)}; after that it goes back up for grabs.</P>
      {m.address && (
        <PillButton accent={accent} href={mapsUrl([m.place, m.address].filter(Boolean).join(", "))}>
          Directions
        </PillButton>
      )}
      <P muted>
        Can&apos;t make it? <a href={`${appUrl()}/lightlab/hold/${h.token}`}>Let it go</a> so someone else can have it.
      </P>
    </EmailLayout>,
  );
  return { to: h.email, replyTo: privateSite.ownerEmail, subject, html, text: toPlainText(html) };
}
