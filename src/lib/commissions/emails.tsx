import "server-only";
import { Text } from "@react-email/components";
import { render, toPlainText } from "@react-email/render";
import { lightlab } from "@config/lightlab";
import { privateSite } from "@config/private.server";
import { accentFor, EmailLayout, H1, P, PillButton } from "@/emails/components/Layout";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email/data";
import type { OutgoingEmail } from "@/lib/email/transport";
import { money } from "@/lib/format";
import { commissionPhotos, commissionUrl } from "./server";

export const COMMISSION_EMAILS = ["commission-received", "commission-new", "commission-quote", "commission-accepted", "commission-declined"] as const;
export type CommissionEmail = (typeof COMMISSION_EMAILS)[number];

/** Null when it no longer applies (e.g. a quote email for a request that's since closed): skipped, not failed. */
export async function buildCommissionEmail(template: CommissionEmail, commissionId: string): Promise<OutgoingEmail | null> {
  const c = await db.lampCommission.findUnique({ where: { id: commissionId } });
  if (!c) return null;
  const accent = accentFor(true);
  const page = `${appUrl()}${commissionUrl(c.token)}`;
  const admin = `${appUrl()}/lightlab/admin/commissions#${c.id}`;
  const first = c.name.split(/\s+/)[0];
  const toCustomer = (subject: string, body: React.ReactNode) => send(c.email, subject, body, privateSite.ownerEmail);
  const toOwner = (subject: string, body: React.ReactNode) => send(privateSite.ownerEmail, subject, body, c.email);
  const idea = <Text style={{ margin: "0 0 14px", padding: "12px 14px", borderRadius: 12, background: "#f4f4f4", whiteSpace: "pre-wrap", fontSize: 14 }}>{c.idea}</Text>;

  switch (template) {
    case "commission-received":
      return toCustomer("We got your lamp idea", (
        <>
          <H1>Thanks, {first}! We got your lamp idea.</H1>
          <P muted>We&apos;ll look it over and send you a price, usually within a couple of days. Nothing to pay until you say yes to the quote.</P>
          {idea}
          <PillButton accent={accent} href={page}>
            Follow your request
          </PillButton>
        </>
      ));
    case "commission-new":
      return toOwner(`New lamp commission from ${c.name}`, (
        <>
          <H1>New lamp commission</H1>
          <P>
            {c.name} · {c.email}
            {c.phone ? ` · ${c.phone}` : ""}
          </P>
          {idea}
          <P muted>
            Shade: {c.shade || "help me choose"}. {c.neededBy ? `Hoping for it by ${c.neededBy}.` : "No date given."} {commissionPhotos(c).length} photo(s).
          </P>
          <PillButton accent={accent} href={admin}>
            Quote it
          </PillButton>
        </>
      ));
    case "commission-quote":
      if (c.status !== "QUOTED" || c.quoteCents == null) return null;
      return toCustomer(`Your lamp quote: ${money(c.quoteCents)}`, (
        <>
          <H1>Your lamp quote is ready</H1>
          <Text style={{ margin: "0 0 12px", fontSize: 28, fontWeight: 800, color: accent.brand }}>{money(c.quoteCents)}</Text>
          {c.quoteNote && <P>{c.quoteNote}</P>}
          <P muted>Happy with it? Say yes and pay by e-Transfer or card, and we&apos;ll start making it. Not quite right? Just reply to this email.</P>
          <PillButton accent={accent} href={page}>
            See the quote
          </PillButton>
        </>
      ));
    case "commission-accepted":
      return toOwner(`${c.name} accepted the ${c.quoteCents != null ? money(c.quoteCents) : ""} lamp quote`, (
        <>
          <H1>Quote accepted</H1>
          <P>{c.name} said yes. It becomes an order as soon as the payment lands (e-Transfer or card).</P>
          {idea}
          <PillButton accent={accent} href={admin}>
            Open it
          </PillButton>
        </>
      ));
    case "commission-declined":
      return toOwner(`${c.name} passed on the lamp quote`, (
        <>
          <H1>Quote declined</H1>
          <P>{c.name} said no thanks to the {c.quoteCents != null ? money(c.quoteCents) : ""} quote. You could reply to ask why or offer something else.</P>
          {idea}
        </>
      ));
  }
}

async function send(to: string, subject: string, body: React.ReactNode, replyTo: string): Promise<OutgoingEmail> {
  const html = await render(
    <EmailLayout brand="lightlab" preview={subject} footerNote={`${lightlab.name} commissions.`}>
      {body}
    </EmailLayout>,
  );
  return { to, replyTo, subject, html, text: toPlainText(html) };
}
