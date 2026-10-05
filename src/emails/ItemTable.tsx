import { Column, Row, Section, Text } from "@react-email/components";
import { money } from "@/lib/format";
import type { OrderEmailData } from "@/lib/email/data";
import { colors } from "./components/Layout";

/** Itemized order lines plus totals. `detail` adds printer, grams and time (owner email). */
export function ItemTable({ d, detail = false }: { d: OrderEmailData; detail?: boolean }) {
  const cell = { margin: 0, fontSize: 14, lineHeight: "20px" };
  return (
    <Section>
      {d.items.map((it, i) => (
        <Row key={i} style={{ borderBottom: `1px solid ${colors.line}` }}>
          <Column style={{ padding: "10px 0", verticalAlign: "top" }}>
            <Text style={{ ...cell, fontWeight: 600 }}>
              {it.fileName} × {it.quantity}
            </Text>
            <Text style={{ ...cell, fontSize: 13, color: colors.muted }}>
              {it.material} · {it.colorName} · {it.size}
            </Text>
            {detail && (
              <Text style={{ ...cell, fontSize: 13, color: colors.muted }}>
                {it.printerName} · {it.quality} quality · {it.infill} infill · {it.grams.toFixed(1)} g · about {it.hoursLabel}
              </Text>
            )}
          </Column>
          <Column style={{ padding: "10px 0", verticalAlign: "top", textAlign: "right", width: 90 }}>
            <Text style={{ ...cell, fontFamily: "monospace" }}>{money(it.lineCents)}</Text>
          </Column>
        </Row>
      ))}
      <TotalRow label="Order fee" value={money(d.baseFeeCents)} />
      {d.minimumAdjCents > 0 && <TotalRow label="Minimum order top-up" value={money(d.minimumAdjCents)} />}
      <TotalRow label="Total paid (CAD)" value={money(d.totalCents)} strong />
      {d.card && <TotalRow label="Paid with" value={d.card} />}
    </Section>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const t = { margin: 0, fontSize: strong ? 16 : 14, lineHeight: "22px", fontWeight: strong ? 700 : 400, color: strong ? colors.text : colors.muted };
  return (
    <Row>
      <Column style={{ paddingTop: 6 }}>
        <Text style={t}>{label}</Text>
      </Column>
      <Column style={{ paddingTop: 6, textAlign: "right" }}>
        <Text style={{ ...t, fontFamily: strong ? undefined : "monospace" }}>{value}</Text>
      </Column>
    </Row>
  );
}
