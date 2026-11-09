import { Body, Column, Container, Head, Html, Img, Link, Preview, Row, Section, Text } from "@react-email/components";
import { lightlab } from "@config/lightlab";
import { money } from "@/lib/format";
import type { OrderEmailData } from "@/lib/email/data";
import { font } from "../components/Layout";

/** LightLab's email look: black and white like the shop, its blue for accents, and a serif italic like the site's script lines. */
export const ll = {
  blue: "#297f9d",
  blueSoft: "#eaf3f6",
  ink: "#111111",
  muted: "#5c5c5c",
  faint: "#8e8e8e",
  line: "#e6e6e3",
  paper: "#f4f3ef",
  warm: "#fff7e6",
  script: "Georgia, 'Times New Roman', Times, serif",
};

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Black header with the logo, a white card, and a footer with the next market. */
export function LightLabFrame({ preview, children, nextMarket }: { preview: string; children: React.ReactNode; nextMarket?: { name: string; when: string } | null }) {
  const base = appUrl();
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: ll.paper, margin: 0, padding: "28px 0", fontFamily: font, color: ll.ink }}>
        <Container style={{ maxWidth: 600, margin: "0 auto", backgroundColor: "#ffffff", borderRadius: 20, overflow: "hidden", border: `1px solid ${ll.line}` }}>
          <Section style={{ backgroundColor: "#0a0a0a", padding: "26px 28px 22px", textAlign: "center" }}>
            <Link href={`${base}/lightlab`}>
              <Img src={`${base}/brand/lightlab-logo-dark.png`} alt={lightlab.name} height={64} style={{ display: "inline-block", height: 64, width: "auto", color: "#ffffff", fontSize: 22, fontWeight: 700 }} />
            </Link>
          </Section>
          {/* a thin line of LightLab blue under the header, like a lit edge */}
          <Section style={{ height: 4, backgroundColor: ll.blue, lineHeight: "4px", fontSize: 0 }}>&nbsp;</Section>
          <Section style={{ padding: "30px 30px 10px" }}>{children}</Section>
          {nextMarket && (
            <Section style={{ padding: "0 30px 24px" }}>
              <Section style={{ backgroundColor: ll.paper, borderRadius: 14, padding: "16px 18px" }}>
                <Text style={{ margin: 0, fontFamily: ll.script, fontStyle: "italic", fontSize: 18, color: ll.blue }}>come say hi</Text>
                <Text style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 700 }}>{nextMarket.name}</Text>
                <Text style={{ margin: "2px 0 0", fontSize: 13, color: ll.muted }}>{nextMarket.when}</Text>
              </Section>
            </Section>
          )}
          <Section style={{ borderTop: `1px solid ${ll.line}`, padding: "18px 30px 26px", textAlign: "center" }}>
            <Text style={{ margin: 0, fontSize: 12, lineHeight: "19px", color: ll.faint }}>
              {lightlab.name} · Novelty lamps, made in Victoria, BC
              <br />
              <Link href={`${base}/lightlab`} style={{ color: ll.ink, textDecoration: "underline" }}>
                Shop online
              </Link>
              {" · "}
              <Link href={`${base}/terms`} style={{ color: ll.faint, textDecoration: "underline" }}>
                Terms
              </Link>
              {" · "}
              <Link href={`${base}/privacy`} style={{ color: ll.faint, textDecoration: "underline" }}>
                Privacy
              </Link>
              <br />
              <span style={{ fontSize: 11 }}>{lightlab.partnerLine}.</span>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** The italic blue line above a heading, like "thanks for your order". */
export function Script({ children }: { children: React.ReactNode }) {
  return <Text style={{ margin: "0 0 2px", fontFamily: ll.script, fontStyle: "italic", fontSize: 24, lineHeight: "30px", color: ll.blue }}>{children}</Text>;
}

export function Heading({ children }: { children: React.ReactNode }) {
  return <Text style={{ margin: "0 0 10px", fontSize: 26, lineHeight: "32px", fontWeight: 800, letterSpacing: "-0.01em", color: ll.ink }}>{children}</Text>;
}

export function Para({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <Text style={{ margin: "0 0 14px", fontSize: 15, lineHeight: "23px", color: muted ? ll.muted : ll.ink }}>{children}</Text>;
}

export function Kicker({ children }: { children: React.ReactNode }) {
  return <Text style={{ margin: "24px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: ll.faint }}>{children}</Text>;
}

export function Button({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ display: "inline-block", backgroundColor: ll.ink, color: "#ffffff", padding: "13px 24px", borderRadius: 999, fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
      {children}
    </Link>
  );
}

/** A soft box for pickup or shipping details. */
export function InfoBox({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <Section style={{ backgroundColor: ll.blueSoft, borderRadius: 14, padding: "14px 18px", margin: "4px 0 8px" }}>
      {rows.map((r, i) => (
        <div key={i}>
          <Text style={{ margin: i ? "10px 0 0" : 0, fontSize: 12, color: ll.muted }}>{r.label}</Text>
          <Text style={{ margin: "2px 0 0", fontSize: 16, lineHeight: "22px", fontWeight: 700, color: ll.ink, whiteSpace: "pre-line" }}>{r.value}</Text>
        </div>
      ))}
    </Section>
  );
}

/** Each lamp with its photo, then the totals. */
export function LampLines({ d }: { d: OrderEmailData }) {
  const total = (label: string, value: string, strong = false) => (
    <Row key={label}>
      <Column style={{ paddingTop: strong ? 10 : 6 }}>
        <Text style={{ margin: 0, fontSize: strong ? 17 : 14, fontWeight: strong ? 800 : 400, color: strong ? ll.ink : ll.muted }}>{label}</Text>
      </Column>
      <Column style={{ paddingTop: strong ? 10 : 6, textAlign: "right" }}>
        <Text style={{ margin: 0, fontSize: strong ? 17 : 14, fontWeight: strong ? 800 : 400, color: strong ? ll.ink : ll.muted }}>{value}</Text>
      </Column>
    </Row>
  );
  return (
    <Section>
      {d.items.map((it, i) => (
        <Row key={i} style={{ borderBottom: `1px solid ${ll.line}` }}>
          <Column style={{ width: 76, padding: "12px 0", verticalAlign: "middle" }}>
            {it.image ? (
              <Img src={it.image} alt="" width={64} height={64} style={{ display: "block", width: 64, height: 64, borderRadius: 14, objectFit: "cover", border: `1px solid ${ll.line}` }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: ll.paper }} />
            )}
          </Column>
          <Column style={{ padding: "12px 0", verticalAlign: "middle" }}>
            <Text style={{ margin: 0, fontSize: 15, lineHeight: "20px", fontWeight: 700 }}>{it.fileName}</Text>
            <Text style={{ margin: "2px 0 0", fontSize: 13, color: ll.muted }}>{[it.colorName, it.quantity > 1 ? `× ${it.quantity}` : null].filter(Boolean).join(" · ") || "LightLab"}</Text>
          </Column>
          <Column style={{ padding: "12px 0", verticalAlign: "middle", textAlign: "right", width: 90 }}>
            <Text style={{ margin: 0, fontSize: 15 }}>{money(it.lineCents)}</Text>
          </Column>
        </Row>
      ))}
      {d.fulfillment === "SHIP" && total(d.shippingLabel ?? "Shipping", money(d.shippingCents))}
      {d.discounts.map((x) => total(x.label, `−${money(x.amountCents)}`))}
      {total("Total", `${money(d.totalCents)} CAD`, true)}
      {d.card && total("Paid with", d.card)}
    </Section>
  );
}

/** Numbered steps, in LightLab blue. */
export function Steps({ steps }: { steps: string[] }) {
  return (
    <>
      {steps.map((s, i) => (
        <Row key={i} style={{ margin: "0 0 8px" }}>
          <Column style={{ width: 34, verticalAlign: "top" }}>
            <Text style={{ margin: 0, width: 24, height: 24, lineHeight: "24px", borderRadius: 999, backgroundColor: ll.blue, color: "#fff", textAlign: "center", fontSize: 12, fontWeight: 700 }}>{i + 1}</Text>
          </Column>
          <Column>
            <Text style={{ margin: "2px 0 8px", fontSize: 15, lineHeight: "22px" }}>{s}</Text>
          </Column>
        </Row>
      ))}
    </>
  );
}
