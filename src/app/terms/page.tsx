import type { Metadata } from "next";
import Link from "next/link";
import { legal, site } from "@config/site";
import { LegalPage, Section } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  const email = legal.contactEmail;
  return (
    <LegalPage
      title="Terms & Conditions"
      intro={
        <p>
          These terms apply to every order placed with {site.name}. By paying for an order you agree to them. If something here is unclear, email{" "}
          <a href={`mailto:${email}`} className="text-accent-text underline underline-offset-4">
            {email}
          </a>{" "}
          before you order.
        </p>
      }
    >
      <Section title="Who we are">
        <p>
          {site.name} is a small 3D printing business based in {legal.province}, Canada. We print customer-supplied STL files in PLA, PETG and PLA-CF. Orders are for local pickup only. We don&apos;t ship.
        </p>
      </Section>

      <Section title="Prices and payment">
        <ul>
          <li>All prices are in Canadian dollars (CAD).</li>
          <li>The total shown at checkout is the amount you pay. It is calculated by our server from your file, size, material and settings.</li>
          <li>Payments are processed by Square. Your order is only placed once Square confirms the payment.</li>
          <li>If we can&apos;t print an order after you&apos;ve paid (for example, the file turns out to be unprintable), we&apos;ll contact you and refund the full amount.</li>
        </ul>
      </Section>

      <Section title="Your files">
        <ul>
          <li>You must own the files you upload or have permission to have them printed.</li>
          <li>You keep all rights to your files. We only use them to print and check your order.</li>
          <li>
            We won&apos;t print weapons or weapon parts, items that copy someone else&apos;s trademark or design without permission, or anything illegal. We can refuse any order. If we refuse a paid order, you get a full
            refund.
          </li>
        </ul>
      </Section>

      <Section title="What to expect from a 3D print">
        <ul>
          <li>Print time and filament weight shown on the site are estimates. They don&apos;t change the price you paid.</li>
          <li>3D prints have visible layer lines and can have small marks where supports were removed.</li>
          <li>Finished sizes can differ slightly from the model, usually by a fraction of a millimetre.</li>
          <li>Colours on screen are close to the real filament but not exact. Translucent and silk filaments look different in person.</li>
          <li>Problems in the file itself (holes in the mesh, very thin walls) can show up in the print. We&apos;ll contact you before printing if we spot a serious problem.</li>
        </ul>
      </Section>

      <Section title="Cancellations and refunds">
        <ul>
          <li>
            <strong>Before printing starts:</strong> you can cancel for a full refund. Email us with your order number. You can see your order&apos;s current stage on the{" "}
            <Link href="/status">order status page</Link>.
          </li>
          <li>
            <strong>After printing starts:</strong> orders are custom-made and can&apos;t be cancelled.
          </li>
          <li>
            <strong>Defects we caused</strong> (failed layers, wrong material or colour, wrong size): tell us within {legal.problemReportDays} days of pickup and we&apos;ll reprint the part or refund it.
          </li>
          <li>Problems that come from the design of the file are not covered.</li>
        </ul>
      </Section>

      <Section title="Pickup">
        <ul>
          <li>We&apos;ll email you when your order is ready. The pickup address is included in that email and in your receipt.</li>
          <li>
            Please collect your order within {legal.pickupWindowDays} days of the ready email. After that we&apos;ll try to contact you. Orders that still aren&apos;t collected may be recycled, and are not refunded.
          </li>
        </ul>
      </Section>

      <Section title="Safety and use">
        <ul>
          <li>Our prints are not certified as toys, food-safe items, or for medical or safety-critical use.</li>
          <li>Small printed parts can be a choking hazard. Keep them away from children under 3.</li>
          <li>PLA softens in heat (around 55 °C). Don&apos;t leave PLA parts in a hot car.</li>
          <li>You are responsible for how you use the parts you order.</li>
        </ul>
      </Section>

      <Section title="Liability">
        <p>
          As far as the law allows, our total liability for any order is limited to the amount you paid for that order. We aren&apos;t liable for indirect losses. Nothing in these terms limits rights you have under{" "}
          {legal.province} consumer protection law.
        </p>
      </Section>

      <Section title="Changes and governing law">
        <p>
          We may update these terms. The version in effect when you paid applies to your order. These terms are governed by the laws of {legal.province} and the federal laws of Canada that apply there.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about an order or these terms: <a href={`mailto:${email}`}>{email}</a>. See also our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
