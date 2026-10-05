import type { Metadata } from "next";
import Link from "next/link";
import { legal, site } from "@config/site";
import { LegalPage, Section } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  const email = legal.contactEmail;
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          This page explains what personal information {site.name} collects, why, who it&apos;s shared with, and how long it&apos;s kept. We follow British Columbia&apos;s Personal Information Protection Act (PIPA).
        </p>
      }
    >
      <Section title="What we collect">
        <ul>
          <li>
            <strong>Order details:</strong> your name, email address, phone number, any notes you add, and what you ordered.
          </li>
          <li>
            <strong>Your files:</strong> the STL files you upload, plus the size and settings you chose.
          </li>
          <li>
            <strong>Payment details:</strong> handled by Square. We never see or store your full card number. We receive the card brand, the last 4 digits, and a Square receipt link.
          </li>
          <li>
            <strong>Technical data:</strong> your IP address is used briefly to limit repeated requests and block abuse. It isn&apos;t saved with your order.
          </li>
        </ul>
      </Section>

      <Section title="Why we use it">
        <ul>
          <li>To print your order and check your files.</li>
          <li>To send your receipt, order updates and the ready-for-pickup email.</li>
          <li>To contact you if there&apos;s a problem with your order.</li>
          <li>To keep business and tax records.</li>
        </ul>
        <p>We don&apos;t sell your information, and we don&apos;t use it for advertising.</p>
      </Section>

      <Section title="Who we share it with">
        <p>Only the services needed to run an order:</p>
        <ul>
          <li>
            <strong>Square</strong>, to process your payment.
          </li>
          <li>
            <strong>Our email provider</strong>, to send receipts and order updates.
          </li>
          <li>
            <strong>Our hosting provider</strong>, which stores the website, the order database and uploaded files.
          </li>
          <li>
            <strong>Discord</strong>, if enabled, to notify us of new orders. These messages include your name and order details.
          </li>
        </ul>
        <p>Some of these services may store data outside Canada, where it is subject to local laws. We may also disclose information if the law requires it.</p>
      </Section>

      <Section title="Cookies and local storage">
        <p>
          We don&apos;t use advertising or tracking cookies. The site sets one small cookie to remember whether you chose the light or dark theme. The admin area uses a login cookie that only affects staff. The
          payment form is provided by Square, which may set its own cookies for fraud prevention.
        </p>
      </Section>

      <Section title="How long we keep it">
        <ul>
          <li>Order and payment records: {legal.recordRetentionYears} years, as required for Canadian tax records.</li>
          <li>Uploaded files for completed orders: {legal.fileRetentionDaysAfterPickup} days after pickup, unless we need them to sort out a problem with the order.</li>
          <li>Files uploaded without placing an order: {legal.abandonedUploadDays} days.</li>
        </ul>
      </Section>

      <Section title="Your choices and rights">
        <p>
          You can ask to see the personal information we hold about you, correct it, or have it deleted (except records we&apos;re required to keep). Email <a href={`mailto:${email}`}>{email}</a> and we&apos;ll
          reply within 30 days.
        </p>
        <p>
          If you&apos;re not happy with our answer, you can contact the{" "}
          <a href="https://www.oipc.bc.ca/" rel="noopener noreferrer" target="_blank">
            Office of the Information and Privacy Commissioner for British Columbia
          </a>
          .
        </p>
      </Section>

      <Section title="Security">
        <p>Payments go directly to Square over an encrypted connection. Order data and files are stored on access-restricted servers, and only we can view them through a password-protected admin area.</p>
      </Section>

      <Section title="Changes">
        <p>
          If we change this policy, we&apos;ll update the date at the top of this page. See also our <Link href="/terms">Terms &amp; Conditions</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
