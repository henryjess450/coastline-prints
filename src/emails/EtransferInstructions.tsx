import { Section, Text } from "@react-email/components";
import { money } from "@/lib/format";
import { colors, EmailLayout, H1, Label, P, PillButton } from "./components/Layout";

export type EtransferEmailData = {
  customerName: string;
  amountCents: number;
  code: string;
  sendTo: string;
  /** "3:45 pm" (shop time) */
  deadline: string;
  waitUrl: string;
};

/** Sent right after an e-Transfer checkout: how to pay, in case they leave the page. */
export function EtransferInstructions({ d }: { d: EtransferEmailData }) {
  const first = d.customerName.split(/\s+/)[0];
  const row = (label: string, value: string, mono = false) => (
    <>
      <Text style={{ margin: "10px 0 0", fontSize: 12, color: colors.muted }}>{label}</Text>
      <Text style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 700, color: colors.brand, fontFamily: mono ? "monospace" : undefined }}>{value}</Text>
    </>
  );
  return (
    <EmailLayout preview={`Send ${money(d.amountCents)} by e-Transfer with code ${d.code}`}>
      <H1>Almost done, {first}!</H1>
      <P muted>Your order is saved. Send the e-Transfer below and it&apos;s confirmed as soon as the money lands, usually within a minute or two.</P>
      <Label>Send an Interac e-Transfer</Label>
      <Section style={{ backgroundColor: colors.brandSoft, borderRadius: 12, padding: "6px 16px 14px" }}>
        {row("To", d.sendTo)}
        {row("Amount", money(d.amountCents))}
        {row("Message (important)", d.code, true)}
      </Section>
      <P muted>Please send it by {d.deadline} (Pacific time). After that the order is cancelled.</P>
      <Section style={{ margin: "8px 0" }}>
        <PillButton href={d.waitUrl}>Check payment status</PillButton>
      </Section>
    </EmailLayout>
  );
}
