import { Img, Section, Text } from "@react-email/components";
import type { GiftData } from "@/lib/giftcards/server";
import { GIFT_WORKS_ON } from "@/lib/giftcards/designs";
import { colors, EmailLayout, H1, Label, P, PillButton } from "./components/Layout";

/** The card details in big, copyable type, next to the card picture. */
function CardDetails({ g }: { g: GiftData }) {
  const big = { margin: "2px 0 12px", fontSize: 22, fontWeight: 700, letterSpacing: "0.04em", color: colors.brand, fontFamily: "'SFMono-Regular', Menlo, Consolas, monospace" } as const;
  return (
    <Section style={{ backgroundColor: colors.brandSoft, borderRadius: 12, padding: "16px 18px", margin: "6px 0 10px" }}>
      <Text style={{ margin: 0, fontSize: 12, color: colors.muted }}>Card number</Text>
      <Text style={big}>{g.number}</Text>
      <Text style={{ margin: 0, fontSize: 12, color: colors.muted }}>PIN</Text>
      <Text style={big}>{g.pin}</Text>
      <Text style={{ margin: 0, fontSize: 12, color: colors.muted }}>Amount</Text>
      <Text style={{ ...big, margin: "2px 0 0" }}>{g.amount}</Text>
    </Section>
  );
}

const first = (name: string) => name.split(/\s+/)[0];

/** To the loved one, at 9 am on the chosen day (or straight away). The button opens the gift on the site. */
export function GiftCardRecipient({ g, orderUrl, redeemUrl }: { g: GiftData; orderUrl: string; redeemUrl: string }) {
  const holiday = g.design === "holiday";
  return (
    <EmailLayout preview={holiday ? `${first(g.buyerName)} sent you a holiday gift. Open it!` : `${first(g.buyerName)} sent you a ${g.amount} gift card`}>
      <H1>
        {first(g.recipientName)}, {first(g.buyerName)} sent you {holiday ? "a holiday gift!" : "a gift card!"}
      </H1>
      <P muted>
        A {g.amount} Coastline Prints gift card, for {GIFT_WORKS_ON}.
      </P>
      {g.revealUrl && (
        <Section style={{ margin: "6px 0 18px" }}>
          <PillButton href={g.revealUrl}>
            {holiday ? "Open your present" : "Open your gift"}
          </PillButton>
        </Section>
      )}
      {g.message && (
        <Section style={{ borderLeft: `4px solid ${colors.brand}`, padding: "4px 0 4px 16px", margin: "8px 0 18px" }}>
          <Text style={{ margin: 0, fontSize: 16, lineHeight: "24px", color: colors.text, whiteSpace: "pre-wrap" }}>{g.message}</Text>
          <Text style={{ margin: "8px 0 0", fontSize: 14, color: colors.muted }}>{g.buyerName}</Text>
        </Section>
      )}
      {/* A holiday gift is a surprise: the card picture waits on the "open your present" page. */}
      {!holiday && <Img src="cid:giftcard" alt={`Gift card, ${g.amount}`} width={525} style={{ display: "block", width: "100%", maxWidth: 525, height: "auto", borderRadius: 24, margin: "8px 0 14px" }} />}
      {holiday && <Label>Your card details, for safekeeping</Label>}
      <CardDetails g={g} />
      <Label>How to use it</Label>
      <P muted>
        Upload an STL file, pick something from the shop, or choose a LightLab lamp, and at checkout type the card number and PIN into the &ldquo;Coupons or Gift Cards&rdquo; box.{" "}
        Whatever you don&apos;t spend stays on the card for next time. It doesn&apos;t expire.
      </P>
      <P muted>
        Tip: save it to your account at{" "}
        <a href={redeemUrl} style={{ color: colors.brand }}>
          {redeemUrl.replace(/^https?:\/\//, "")}
        </a>
        . Then it&apos;s ready to tap at checkout, and it&apos;s locked to you, so nobody else can use it.
      </P>
      <Section style={{ margin: "18px 0 4px" }}>
        <PillButton href={orderUrl}>Start an order</PillButton>
      </Section>
    </EmailLayout>
  );
}

/** Receipt for the person who bought it, with a copy of the card. */
export function GiftCardBuyer({ g, when }: { g: GiftData; when: string | null }) {
  return (
    <EmailLayout preview={when ? `Your gift for ${g.recipientName} is scheduled for ${when}` : `Your gift for ${g.recipientName} is on its way`}>
      <H1>Thanks, {first(g.buyerName)}! Your gift is {when ? "all set" : "on its way"}.</H1>
      <P muted>
        {when ? (
          <>
            We&apos;ll email the {g.amount} gift card to {g.recipientName} ({g.recipientEmail}) at 9 am Pacific on <strong style={{ color: colors.text }}>{when}</strong>.
          </>
        ) : (
          <>
            We&apos;ve emailed the {g.amount} gift card to {g.recipientName} ({g.recipientEmail}).
          </>
        )}
      </P>
      <Label>Receipt</Label>
      <Text style={{ margin: "0 0 4px", fontSize: 14 }}>Gift card · {g.paid} CAD</Text>
      {g.bonus && <Text style={{ margin: "0 0 4px", fontSize: 14, color: colors.muted }}>Plus a {g.bonus} bonus, so the card is worth {g.amount}</Text>}
      {g.card && <Text style={{ margin: "0 0 4px", fontSize: 14, color: colors.muted }}>Paid with {g.card}</Text>}
      {g.receiptUrl && (
        <Text style={{ margin: "0 0 4px", fontSize: 14 }}>
          <a href={g.receiptUrl} style={{ color: colors.brand }}>
            View your Square receipt
          </a>
        </Text>
      )}
      <Label>A copy of the card</Label>
      <P muted>Just in case the email goes astray, here are the details. Please keep them private.</P>
      <Img src="cid:giftcard" alt={`Gift card, ${g.amount}`} width={525} style={{ display: "block", width: "100%", maxWidth: 525, height: "auto", borderRadius: 24, margin: "8px 0 14px" }} />
      <CardDetails g={g} />
    </EmailLayout>
  );
}

/** Heads-up for the shop. */
export function GiftCardOwner({ g, when }: { g: GiftData; when: string | null }) {
  return (
    <EmailLayout preview={`Gift card sold: ${g.paid}`}>
      <H1>Gift card sold: {g.paid}</H1>
      {g.bonus && <P muted>Includes a {g.bonus} bonus: the card is worth {g.amount}.</P>}
      <P muted>
        From {g.buyerName} ({g.buyerEmail}) to {g.recipientName} ({g.recipientEmail}). {when ? `Emails to the recipient on ${when} at 9 am.` : "Emailed to the recipient now."}
      </P>
      <Text style={{ margin: 0, fontSize: 13, color: colors.faint }}>
        Card {g.number} · it&apos;s listed under Codes in the admin dashboard.
      </Text>
    </EmailLayout>
  );
}
