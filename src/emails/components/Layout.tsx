import { Body, Container, Head, Hr, Html, Img, Link, Preview, Section, Text } from "@react-email/components";
import { site } from "@config/site";

export const colors = {
  brand: "#0e4471",
  brandSoft: "#e8f0f8",
  text: "#0b1622",
  muted: "#4a5b6d",
  faint: "#7a8a9c",
  line: "#dbe3eb",
  bg: "#f5f8fb",
};

export const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Shared branded frame for every email: navy header, white card, small footer. */
export function EmailLayout({ preview, children, footerNote }: { preview: string; children: React.ReactNode; footerNote?: string }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: colors.bg, margin: 0, padding: "24px 0", fontFamily: font, color: colors.text }}>
        <Container style={{ maxWidth: 600, margin: "0 auto", backgroundColor: "#ffffff", borderRadius: 16, overflow: "hidden", border: `1px solid ${colors.line}` }}>
          <Section style={{ backgroundColor: colors.brand, padding: "20px 28px" }}>
            <Img src={`${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/brand/wordmark-white.png`} alt={site.name} height={56} style={{ display: "block", height: 56, width: "auto", color: "#ffffff", fontSize: 20, fontWeight: 700 }} />
          </Section>
          <Section style={{ padding: "28px" }}>{children}</Section>
          <Hr style={{ borderColor: colors.line, margin: 0 }} />
          <Section style={{ padding: "16px 28px 24px" }}>
            <Text style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: colors.faint }}>
              {footerNote ?? `${site.name} · Custom 3D printing · ${site.fulfillmentLabel} only.`}
              <br />
              <Link href={`${process.env.APP_URL ?? "http://localhost:3000"}/terms`} style={{ color: colors.faint, textDecoration: "underline" }}>
                Terms
              </Link>{" "}
              ·{" "}
              <Link href={`${process.env.APP_URL ?? "http://localhost:3000"}/privacy`} style={{ color: colors.faint, textDecoration: "underline" }}>
                Privacy
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function PillButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{ display: "inline-block", backgroundColor: colors.brand, color: "#ffffff", padding: "12px 22px", borderRadius: 999, fontWeight: 600, fontSize: 15, textDecoration: "none" }}
    >
      {children}
    </Link>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={{ margin: "0 0 8px", fontSize: 24, lineHeight: "30px", fontWeight: 700, color: colors.text }}>{children}</Text>;
}

export function P({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <Text style={{ margin: "0 0 14px", fontSize: 15, lineHeight: "23px", color: muted ? colors.muted : colors.text }}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={{ margin: "18px 0 6px", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.faint }}>{children}</Text>;
}

/** The customer's own shipping address. */
export function ShipToBox({ lines, label = "Shipping to" }: { lines: string[]; label?: string }) {
  return (
    <Section style={{ backgroundColor: colors.brandSoft, borderRadius: 12, padding: "14px 16px", margin: "4px 0 6px" }}>
      <Text style={{ margin: 0, fontSize: 12, color: colors.muted }}>{label}</Text>
      {lines.map((l, i) => (
        <Text key={i} style={{ margin: i ? 0 : "2px 0 0", fontSize: 16, lineHeight: "22px", fontWeight: i ? 400 : 700, color: colors.brand }}>
          {l}
        </Text>
      ))}
    </Section>
  );
}

/** Highlighted pickup box (receipt and ready emails only). */
export function AddressBox({ address, when }: { address: string; when?: string | null }) {
  return (
    <Section style={{ backgroundColor: colors.brandSoft, borderRadius: 12, padding: "14px 16px", margin: "4px 0 6px" }}>
      {when && (
        <>
          <Text style={{ margin: 0, fontSize: 12, color: colors.muted }}>Pickup time</Text>
          <Text style={{ margin: "2px 0 10px", fontSize: 17, fontWeight: 700, color: colors.brand }}>{when}</Text>
        </>
      )}
      <Text style={{ margin: 0, fontSize: 12, color: colors.muted }}>Pickup address</Text>
      <Text style={{ margin: "2px 0 0", fontSize: 17, fontWeight: 700, color: colors.brand }}>{address}</Text>
    </Section>
  );
}
