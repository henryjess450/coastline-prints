import { Link, Section, Text } from "@react-email/components";
import { money } from "@/lib/format";
import type { OrderEmailData } from "@/lib/email/data";
import { AddressBox, colors, EmailLayout, H1, Label, P, PillButton, ShipToBox } from "./components/Layout";
import { ItemTable } from "./ItemTable";

export function CustomerReceipt({ d }: { d: OrderEmailData }) {
  const first = d.customerName.split(/\s+/)[0];
  const steps = [
    "We check your files and queue them on the right printer.",
    "Your parts are printed and cleaned up.",
    d.shipTo ? (d.tracked ? "We pack it and send it with Canada Post, then email you the tracking number." : "We pack it in a padded mailer and send it by Canada Post Lettermail (no tracking), then email you.") : "We email you when it's ready, before your pickup time.",
  ];
  return (
    <EmailLayout preview={`Order ${d.orderNumber} confirmed · ${money(d.totalCents)} paid`}>
      <H1>Thanks, {first}. Your order is confirmed.</H1>
      <P muted>
        Order <strong style={{ color: colors.text }}>{d.orderNumber}</strong> · {money(d.totalCents)} CAD paid
      </P>

      <Label>Your order</Label>
      <ItemTable d={d} />
      <Text style={{ margin: "10px 0 0", fontSize: 13 }}>
        Your invoice is attached as a PDF.{" "}
        <Link href={d.links.invoice} style={{ color: colors.brand }}>
          See it online
        </Link>
        {d.links.receipt && (
          <>
            {" · "}
            <Link href={d.links.receipt} style={{ color: colors.brand }}>
              Square payment receipt
            </Link>
          </>
        )}
      </Text>

      <Label>What happens next</Label>
      {steps.map((s, i) => (
        <Text key={i} style={{ margin: "0 0 6px", fontSize: 15, lineHeight: "22px" }}>
          <span style={{ display: "inline-block", width: 22, height: 22, lineHeight: "22px", borderRadius: 999, backgroundColor: colors.brand, color: "#fff", textAlign: "center", fontSize: 12, fontWeight: 700, marginRight: 8 }}>{i + 1}</span>
          {s}
        </Text>
      ))}

      {d.shipTo ? (
        <>
          <Label>Shipping</Label>
          <P muted>Prints usually take 2 to 5 days, then Canada Post delivery takes a few more. If anything in this address is wrong, reply to this email before it ships.</P>
          <ShipToBox lines={d.shipTo} />
        </>
      ) : (
        <>
          <Label>Pickup</Label>
          <P muted>
            {d.pickupWhen
              ? "Here's the pickup time you chose. We'll email you to confirm once your order is ready. If the time stops working for you, just reply to this email."
              : "This order is for local pickup. Please wait for the \"ready for pickup\" email before coming by."}
          </P>
          <AddressBox address={d.pickupAddress ?? ""} when={d.pickupWhen} />
          <Text style={{ margin: "0 0 20px", fontSize: 12, color: colors.faint }}>Please keep this address private.</Text>
        </>
      )}

      <Section style={{ margin: "8px 0 4px" }}>
        <PillButton href={d.links.status}>Track your order</PillButton>
      </Section>
      <P muted>
        Questions? Just reply to this email. Your order details are also at{" "}
        <Link href={d.links.confirmation} style={{ color: colors.brand }}>
          your order page
        </Link>
        .
      </P>
    </EmailLayout>
  );
}
