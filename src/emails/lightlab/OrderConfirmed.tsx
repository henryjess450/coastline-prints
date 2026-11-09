import { Link, Section, Text } from "@react-email/components";
import { money } from "@/lib/format";
import type { OrderEmailData } from "@/lib/email/data";
import { Button, Heading, InfoBox, Kicker, LampLines, LightLabFrame, ll, Para, Script, Steps } from "./parts";

/** A LightLab order placed on the website. */
export function LightLabOrderConfirmed({ d, signInUrl }: { d: OrderEmailData; signInUrl?: string }) {
  const first = d.customerName.split(/\s+/)[0];
  const lamps = d.items.reduce((n, i) => n + i.quantity, 0);
  // Taken at the register (or the kiosk) to make later: made by the day they picked, not taken off the shelf.
  const madeToOrder = !!signInUrl;
  const steps = [
    madeToOrder ? `We make your ${lamps === 1 ? "lamp" : "lamps"} in the colours you picked.` : `We take your ${lamps === 1 ? "lamp" : "lamps"} off the shelf and check ${lamps === 1 ? "it" : "them"} over.`,
    d.shipTo ? (d.tracked ? "We pack it carefully and send it with Canada Post, then email you the tracking number." : "We pack it in a padded mailer and send it by Canada Post, then email you.") : d.atMarket ? "We bring it to the market for you." : "We email you as soon as it's ready to pick up.",
  ];
  return (
    <LightLabFrame preview={`Order ${d.orderNumber} confirmed · ${money(d.totalCents)}`} nextMarket={d.shipTo ? null : d.nextMarket}>
      <Script>thanks for your order!</Script>
      <Heading>{madeToOrder ? `We're making your ${lamps === 1 ? "lamp" : "lamps"}, ${first}.` : d.shipTo ? `${lamps === 1 ? "Your lamp is" : "Your lamps are"} on the way, ${first}.` : `${lamps === 1 ? "Your lamp is" : "Your lamps are"} saved for you, ${first}.`}</Heading>
      <Para muted>
        Order <strong style={{ color: ll.ink }}>{d.orderNumber}</strong> · {money(d.totalCents)} CAD paid. Your invoice is attached.
      </Para>

      <Kicker>Your order</Kicker>
      <LampLines d={d} />

      <Kicker>What happens next</Kicker>
      <Steps steps={steps} />

      {d.shipTo ? (
        <>
          <Kicker>Shipping to</Kicker>
          <InfoBox rows={[{ label: d.shippingLabel ?? "Canada Post", value: d.shipTo.join("\n") }]} />
          <Para muted>Anything wrong with this address? Reply to this email before it ships.</Para>
        </>
      ) : (
        <>
          <Kicker>Pickup</Kicker>
          <InfoBox rows={[...(d.pickupWhen ? [{ label: madeToOrder ? "Ready by" : d.atMarket ? "Market" : "Pickup time", value: d.pickupWhen }] : []), { label: d.atMarket ? "Where" : "Pickup address", value: d.pickupAddress ?? "" }]} />
          <Para muted>{madeToOrder ? "We'll email you when it's ready, to set a pickup time. Rather have it shipped? Just reply." : d.atMarket ? "Come find the LightLab stand and give us your order number." : "Please wait for the ready email before coming by, and keep the address to yourself."}</Para>
        </>
      )}

      <Section style={{ margin: "14px 0 18px" }}>
        <Button href={signInUrl ?? d.links.status}>{signInUrl ? "Sign in and track your order" : "Track your order"}</Button>
      </Section>
      <Text style={{ margin: "0 0 18px", fontSize: 13, color: ll.muted }}>
        Questions? Just reply. Everything&apos;s also on{" "}
        <Link href={d.links.confirmation} style={{ color: ll.blue }}>
          your order page
        </Link>
        {d.links.receipt && (
          <>
            {" "}and in your{" "}
            <Link href={d.links.receipt} style={{ color: ll.blue }}>
              Square receipt
            </Link>
          </>
        )}
        .
      </Text>
    </LightLabFrame>
  );
}
