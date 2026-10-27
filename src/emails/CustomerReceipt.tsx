import { Link, Section, Text } from "@react-email/components";
import { money } from "@/lib/format";
import type { OrderEmailData } from "@/lib/email/data";
import { accentFor, AddressBox, colors, EmailLayout, H1, Label, P, PillButton, ShipToBox } from "./components/Layout";
import { ItemTable } from "./ItemTable";

/** `signInUrl`: an order taken at the register, where we also made their account. One tap signs them in. */
export function CustomerReceipt({ d, signInUrl }: { d: OrderEmailData; signInUrl?: string }) {
  const first = d.customerName.split(/\s+/)[0];
  const accent = accentFor(d.lightlab);
  const steps = [
    ...(d.lightlab
      ? ["We take your lamp off the shelf and check it over."]
      : d.products
        ? ["We print your order (with your personalisation, if it has one).", "It's cleaned up and checked over."]
        : ["We check your files and queue them on the right printer.", "Your parts are printed and cleaned up."]),
    d.shipTo ? (d.tracked ? "We pack it and send it with Canada Post, then email you the tracking number." : "We pack it in a padded mailer and send it by Canada Post Lettermail (no tracking), then email you.") : "We email you when it's ready, before your pickup time.",
  ];
  return (
    <EmailLayout preview={`Order ${d.orderNumber} confirmed · ${money(d.totalCents)} paid`} brand={d.lightlab ? "lightlab" : "coastline"}>
      <H1>Thanks, {first}. Your order is confirmed.</H1>
      <P muted>
        Order <strong style={{ color: colors.text }}>{d.orderNumber}</strong> · {money(d.totalCents)} CAD paid
      </P>

      <Label accent={accent}>Your order</Label>
      <ItemTable d={d} />
      <Text style={{ margin: "10px 0 0", fontSize: 13 }}>
        Your invoice is attached as a PDF.{" "}
        <Link href={d.links.invoice} style={accent.link}>
          See it online
        </Link>
        {d.links.receipt && (
          <>
            {" · "}
            <Link href={d.links.receipt} style={accent.link}>
              Square payment receipt
            </Link>
          </>
        )}
      </Text>

      <Label accent={accent}>What happens next</Label>
      {steps.map((s, i) => (
        <Text key={i} style={{ margin: "0 0 6px", fontSize: 15, lineHeight: "22px" }}>
          <span style={{ display: "inline-block", width: 22, height: 22, lineHeight: "22px", borderRadius: 999, backgroundColor: accent.brand, color: "#fff", textAlign: "center", fontSize: 12, fontWeight: 700, marginRight: 8 }}>{i + 1}</span>
          {s}
        </Text>
      ))}

      {d.shipTo ? (
        <>
          <Label accent={accent}>Shipping</Label>
          <P muted>{d.lightlab ? "We pack it in a few days" : "Prints usually take 2 to 5 days"}, then Canada Post delivery takes a few more. If anything in this address is wrong, reply to this email before it ships.</P>
          <ShipToBox accent={accent} lines={d.shipTo} />
        </>
      ) : (
        <>
          <Label accent={accent}>Pickup</Label>
          <P muted>
            {signInUrl
              ? "Your order will be ready by the day below. We'll email you when it's ready to pick up, and to set a time. If you'd rather have it shipped, just reply: we'll tell you the cost once it's printed."
              : d.pickupWhen
              ? "Here's the pickup time you chose. We'll email you to confirm once your order is ready. If the time stops working for you, just reply to this email."
              : "This order is for local pickup. Please wait for the \"ready for pickup\" email before coming by."}
          </P>
          <AddressBox accent={accent} address={d.pickupAddress ?? ""} when={d.pickupWhen} whenLabel={signInUrl ? "Ready by" : undefined} />
          <Text style={{ margin: "0 0 20px", fontSize: 12, color: colors.faint }}>Please keep this address private.</Text>
        </>
      )}

      {signInUrl ? (
        <>
          <Label accent={accent}>Your account</Label>
          <P muted>We set up an account with this email so you can follow your order, collect reward points and save gift cards. The button signs you straight in, no password needed.</P>
          <Section style={{ margin: "8px 0 4px" }}>
            <PillButton accent={accent} href={signInUrl}>Sign in and track your order</PillButton>
          </Section>
        </>
      ) : (
        <Section style={{ margin: "8px 0 4px" }}>
          <PillButton accent={accent} href={d.links.status}>Track your order</PillButton>
        </Section>
      )}
      <P muted>
        Questions? Just reply to this email. Your order details are also at{" "}
        <Link href={d.links.confirmation} style={accent.link}>
          your order page
        </Link>
        .
      </P>
    </EmailLayout>
  );
}
