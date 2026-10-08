import { Section, Text } from "@react-email/components";
import type { OrderEmailData } from "@/lib/email/data";
import { AddressBox, colors, EmailLayout, H1, Label, P, PillButton } from "./components/Layout";

export function ReadyForPickup({ d, pickupWindowDays }: { d: OrderEmailData; pickupWindowDays: number }) {
  const first = d.customerName.split(/\s+/)[0];
  return (
    <EmailLayout preview={`Order ${d.orderNumber} is ready for pickup`}>
      <H1>Good news, {first}. Your order is ready!</H1>
      <P muted>
        Order <strong style={{ color: colors.text }}>{d.orderNumber}</strong> is printed, cleaned up and waiting for you.
      </P>
      <Label>Pickup details</Label>
      <AddressBox address={d.pickupAddress ?? ""} when={d.pickupWhen} />
      <P muted>
        {d.pickupWhen
          ? "See you then! If that time no longer works, reply to this email and we'll find another one. Please bring your order number."
          : "Reply to this email to arrange a pickup time. Please bring your order number."}
      </P>

      <Label>Your items</Label>
      {d.items.map((it, i) => (
        <Text key={i} style={{ margin: "0 0 4px", fontSize: 14 }}>
          {it.fileName} × {it.quantity} · {it.material} {it.colorName}
        </Text>
      ))}

      <Text style={{ margin: "18px 0", fontSize: 13, lineHeight: "20px", color: colors.faint }}>
        Please collect your order within {pickupWindowDays} days. Orders left longer than that may be recycled.
      </Text>
      <Section>
        <PillButton href={d.links.status}>View order status</PillButton>
      </Section>
    </EmailLayout>
  );
}
