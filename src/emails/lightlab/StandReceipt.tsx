import { Column, Link, Row, Section, Text } from "@react-email/components";
import { money } from "@/lib/format";
import type { OrderEmailData } from "@/lib/email/data";
import { Button, Heading, Kicker, LampLines, LightLabFrame, ll, Para, Script } from "./parts";

const CARE = [
  ["Bulb", "Use a warm LED bulb (7 W or less). They stay cool, so the print never softens."],
  ["Heat", "Keep it away from heaters, sunny windowsills and hot cars."],
  ["Dust", "A soft dry brush or a puff of air gets into the little holes."],
] as const;

/** A receipt for a LightLab sale made in person: at the stand register or the self-checkout kiosk. */
export function LightLabStandReceipt({ d, signInUrl }: { d: OrderEmailData; signInUrl?: string }) {
  const first = d.customerName.split(/\s+/)[0];
  const when = new Date(d.createdAt).toLocaleString("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Vancouver" });
  return (
    <LightLabFrame preview={`Your LightLab receipt · ${money(d.totalCents)}`} nextMarket={d.nextMarket}>
      <Script>thanks for stopping by!</Script>
      <Heading>{first ? `Enjoy your new lamp, ${first}.` : "Enjoy your new lamp."}</Heading>
      <Para muted>
        Receipt <strong style={{ color: ll.ink }}>{d.orderNumber}</strong> · {when}
        {d.source ? ` · ${d.source}` : ""}
      </Para>

      <Kicker>Your receipt</Kicker>
      <LampLines d={d} />

      <Kicker>Looking after your lamp</Kicker>
      <Section style={{ backgroundColor: ll.warm, borderRadius: 14, padding: "6px 18px" }}>
        {CARE.map(([title, text]) => (
          <Row key={title}>
            <Column style={{ width: 64, verticalAlign: "top", paddingTop: 10 }}>
              <Text style={{ margin: 0, fontFamily: ll.script, fontStyle: "italic", fontSize: 17, color: ll.blue }}>{title}</Text>
            </Column>
            <Column style={{ paddingTop: 10, paddingBottom: 6 }}>
              <Text style={{ margin: 0, fontSize: 14, lineHeight: "21px" }}>{text}</Text>
            </Column>
          </Row>
        ))}
      </Section>

      {signInUrl ? (
        <>
          <Kicker>Your account</Kicker>
          <Para muted>We made you an account with this email, for reward points and LightLab news. One tap signs you in, no password.</Para>
          <Section style={{ margin: "4px 0 18px" }}>
            <Button href={signInUrl}>Sign in</Button>
          </Section>
        </>
      ) : (
        <Section style={{ margin: "22px 0 18px" }}>
          <Button href={d.links.confirmation.replace(/\/orders\/.*/, "/lightlab")}>See what&apos;s new online</Button>
        </Section>
      )}
      <Text style={{ margin: "0 0 18px", fontSize: 13, color: ll.muted }}>
        Something not right? Just reply to this email.{" "}
        <Link href={d.links.invoice} style={{ color: ll.blue }}>
          Printable receipt
        </Link>
        {d.links.receipt && (
          <>
            {" · "}
            <Link href={d.links.receipt} style={{ color: ll.blue }}>
              Square receipt
            </Link>
          </>
        )}
      </Text>
    </LightLabFrame>
  );
}
