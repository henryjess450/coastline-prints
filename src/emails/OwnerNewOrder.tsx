import { Section, Text } from "@react-email/components";
import { money } from "@/lib/format";
import type { OrderEmailData } from "@/lib/email/data";
import { colors, EmailLayout, H1, Label, P, PillButton, ShipToBox } from "./components/Layout";
import { ItemTable } from "./ItemTable";

export function OwnerNewOrder({ d }: { d: OrderEmailData }) {
  const line = { margin: "0 0 2px", fontSize: 15, lineHeight: "22px" };
  return (
    <EmailLayout preview={`${d.orderNumber}: ${money(d.totalCents)} from ${d.customerName}`} footerNote="Owner notification. Not sent to the customer.">
      <H1>New order {d.orderNumber}</H1>
      <P muted>
        {money(d.totalCents)} paid · {d.items.reduce((n, i) => n + i.quantity, 0)} piece(s) · about {d.totalGrams.toFixed(0)} g and {d.totalHoursLabel} of printing
      </P>

      <Label>Customer</Label>
      <Text style={line}>{d.customerName}</Text>
      {d.returning && <Text style={{ ...line, fontWeight: 700, color: colors.brand }}>★ {d.returning}</Text>}
      <Text style={line}>
        <a href={`mailto:${d.customerEmail}`} style={{ color: colors.brand }}>
          {d.customerEmail}
        </a>
      </Text>
      <Text style={line}>
        <a href={`tel:${d.customerPhone.replace(/[^\d+]/g, "")}`} style={{ color: colors.brand }}>
          {d.customerPhone}
        </a>
      </Text>

      {d.shipTo ? (
        <>
          <Label>Ship by Canada Post</Label>
          <ShipToBox lines={d.shipTo} label={d.shippingLabel ?? "Ship to"} />
        </>
      ) : (
        <>
          <Label>Pickup</Label>
          <Text style={{ ...line, fontWeight: 700, color: colors.brand }}>{d.pickupWhen ?? "Not booked"}</Text>
        </>
      )}

      {d.notes && (
        <>
          <Label>Customer notes</Label>
          <Section style={{ backgroundColor: colors.brandSoft, borderRadius: 10, padding: "10px 14px" }}>
            <Text style={{ margin: 0, fontSize: 14, lineHeight: "21px", whiteSpace: "pre-wrap" }}>{d.notes}</Text>
          </Section>
        </>
      )}

      <Label>Items</Label>
      <ItemTable d={d} detail />

      <Section style={{ margin: "22px 0 4px" }}>
        <PillButton href={d.links.admin}>Open in admin</PillButton>
      </Section>
    </EmailLayout>
  );
}
