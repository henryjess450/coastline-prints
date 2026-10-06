import { Section, Text } from "@react-email/components";
import { colors, EmailLayout, H1, Label, P, PillButton } from "./components/Layout";

/** Thank-you coupon after a customer's first order is picked up. */
export function FirstOrderCoupon({ firstName, amount, number, useBy, saved, orderUrl, redeemUrl }: { firstName: string; amount: string; number: string; useBy: string; saved: boolean; orderUrl: string; redeemUrl: string }) {
  return (
    <EmailLayout preview={`Thanks for your first order! Here's ${amount} off your next one.`}>
      <H1>Thanks for your first order, {firstName}!</H1>
      <P muted>We hope you love your print. Here&apos;s {amount} off your next order, as a thank-you.</P>
      <Section style={{ backgroundColor: colors.brandSoft, borderRadius: 12, padding: "16px 18px", margin: "6px 0 10px" }}>
        <Text style={{ margin: 0, fontSize: 12, color: colors.muted }}>Coupon number</Text>
        <Text style={{ margin: "2px 0 12px", fontSize: 24, fontWeight: 700, letterSpacing: "0.04em", color: colors.brand, fontFamily: "'SFMono-Regular', Menlo, Consolas, monospace" }}>{number}</Text>
        <Text style={{ margin: 0, fontSize: 12, color: colors.muted }}>Value</Text>
        <Text style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 700, color: colors.brand }}>{amount} off</Text>
      </Section>
      <Text style={{ margin: "0 0 4px", fontSize: 13, color: colors.faint }}>One-time use · Use by {useBy}</Text>
      <Label>How to use it</Label>
      {saved ? (
        <P muted>It&apos;s already saved to your Coastline Prints account. Sign in before checkout and tap it to use it.</P>
      ) : (
        <P muted>
          Type the number into the &ldquo;Coupons or Gift Cards&rdquo; box at checkout. Or save it to your account at{" "}
          <a href={redeemUrl} style={{ color: colors.brand }}>
            {redeemUrl.replace(/^https?:\/\//, "")}
          </a>{" "}
          so it&apos;s ready to tap when you order.
        </P>
      )}
      <Section style={{ margin: "18px 0 4px" }}>
        <PillButton href={orderUrl}>Start your next order</PillButton>
      </Section>
    </EmailLayout>
  );
}
