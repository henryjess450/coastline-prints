import { Section } from "@react-email/components";
import type { OrderEmailData } from "@/lib/email/data";
import { statusInfo } from "@/lib/orders/status";
import { colors, EmailLayout, H1, P, PillButton, accentFor } from "./components/Layout";

export function StatusUpdate({ d, note }: { d: OrderEmailData; note?: string | null }) {
  const accent = accentFor(d.lightlab);
  const s = statusInfo(d.status, d.fulfillment);
  return (
    <EmailLayout preview={`Order ${d.orderNumber}: ${s.label}`} brand={d.lightlab ? "lightlab" : "coastline"}>
      <H1>Order update: {s.label}</H1>
      <P muted>
        Order <strong style={{ color: colors.text }}>{d.orderNumber}</strong>. {s.customer}
      </P>
      {note && <P>{note}</P>}
      <Section style={{ marginTop: 8 }}>
        <PillButton accent={accent} href={d.links.status}>View order status</PillButton>
      </Section>
    </EmailLayout>
  );
}
