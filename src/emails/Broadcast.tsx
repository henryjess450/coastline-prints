import { Link, Section, Text } from "@react-email/components";
import { colors, EmailLayout, H1, P, PillButton } from "./components/Layout";

export type BroadcastEmailProps = { heading: string; body: string; linkUrl?: string | null; linkLabel?: string | null; code?: string | null; unsubscribeUrl: string; mailingAddress?: string };

/** News or a coupon campaign, sent to customers who haven't opted out. Always has an unsubscribe link. */
export function BroadcastEmail({ heading, body, linkUrl, linkLabel, code, unsubscribeUrl, mailingAddress }: BroadcastEmailProps) {
  return (
    <EmailLayout preview={body.slice(0, 120)}>
      <H1>{heading}</H1>
      {body.split(/\n{2,}/).map((para, i) => (
        <P key={i}>{para}</P>
      ))}
      {code && (
        <Section style={{ backgroundColor: colors.brandSoft, borderRadius: 12, padding: "16px 20px", margin: "6px 0 16px", textAlign: "center" }}>
          <Text style={{ margin: 0, fontSize: 12, color: colors.faint, textTransform: "uppercase", letterSpacing: "0.12em" }}>Your code</Text>
          <Text style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 700, letterSpacing: "0.12em", color: colors.brand, fontFamily: "'SFMono-Regular', Menlo, Consolas, monospace" }}>{code}</Text>
        </Section>
      )}
      {linkUrl && <PillButton href={linkUrl}>{linkLabel || "Take a look"}</PillButton>}
      <Text style={{ margin: "28px 0 0", fontSize: 12, lineHeight: "18px", color: colors.faint }}>
        You&apos;re getting this because you have a Coastline Prints account.{" "}
        <Link href={unsubscribeUrl} style={{ color: colors.faint, textDecoration: "underline" }}>
          Unsubscribe from news and offers
        </Link>
        . Order emails still come.
        {mailingAddress ? (
          <>
            <br />
            {mailingAddress}
          </>
        ) : null}
      </Text>
    </EmailLayout>
  );
}
