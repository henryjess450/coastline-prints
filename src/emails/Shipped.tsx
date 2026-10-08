import { Link, Section, Text } from "@react-email/components";
import type { OrderEmailData } from "@/lib/email/data";
import { colors, EmailLayout, H1, Label, P, PillButton, ShipToBox } from "./components/Layout";

export function Shipped({ d, note }: { d: OrderEmailData; note?: string | null }) {
  const first = d.customerName.split(/\s+/)[0];
  return (
    <EmailLayout preview={`Order ${d.orderNumber} is on its way`}>
      <H1>Good news, {first}. Your order has shipped!</H1>
      <P muted>
        Order <strong style={{ color: colors.text }}>{d.orderNumber}</strong> is packed and on its way with Canada Post.
      </P>
      {note && <P>{note}</P>}

      {d.tracking && (
        <>
          <Label>Tracking number</Label>
          <Text style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: colors.brand }}>
            <Link href={d.tracking.url} style={{ color: colors.brand }}>
              {d.tracking.number}
            </Link>
          </Text>
        </>
      )}

      {!d.tracked && <P muted>It&apos;s in a padded bubble mailer sent by Lettermail, so there&apos;s no tracking number. It usually arrives within a few business days.</P>}

      {d.shipTo && (
        <>
          <Label>Shipping to</Label>
          <ShipToBox lines={d.shipTo} label={d.shippingLabel ?? "Canada Post"} />
        </>
      )}

      <Label>Your items</Label>
      {d.items.map((it, i) => (
        <Text key={i} style={{ margin: "0 0 4px", fontSize: 14 }}>
          {it.fileName} × {it.quantity} · {it.material} {it.colorName}
        </Text>
      ))}

      <Section style={{ marginTop: 18 }}>
        <PillButton href={d.tracking?.url ?? d.links.status}>{d.tracking ? "Track your package" : "View order status"}</PillButton>
      </Section>
      <P muted>If something arrives damaged, reply to this email with a photo and we&apos;ll sort it out.</P>
    </EmailLayout>
  );
}
