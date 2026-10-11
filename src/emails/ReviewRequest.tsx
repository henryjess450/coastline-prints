import { Section } from "@react-email/components";
import { EmailLayout, H1, P, PillButton } from "./components/Layout";

/** A day after pickup or delivery: one plain ask for a Google review. */
export function ReviewRequest({ firstName, orderNumber, shipped, reviewUrl, problemDays }: { firstName: string; orderNumber: string; shipped: boolean; reviewUrl: string; problemDays: number }) {
  return (
    <EmailLayout preview="How did your print turn out?">
      <H1>How did your print turn out, {firstName}?</H1>
      <P muted>
        Thanks for {shipped ? "ordering" : "picking up"} order <strong>{orderNumber}</strong>. If you have a minute, a quick Google review helps a small Victoria shop more than anything else. It&apos;s how other people
        nearby find us.
      </P>
      <Section style={{ margin: "18px 0 8px" }}>
        <PillButton href={reviewUrl}>Leave a Google review</PillButton>
      </Section>
      <P muted>Something not right with your print? Just reply to this email within {problemDays} days and we&apos;ll sort it out.</P>
    </EmailLayout>
  );
}
