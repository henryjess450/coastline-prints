import "server-only";
import { render, toPlainText } from "@react-email/render";
import { legal } from "@config/site";
import { privateSite } from "@config/private.server";
import { CustomerReceipt } from "@/emails/CustomerReceipt";
import { OwnerNewOrder } from "@/emails/OwnerNewOrder";
import { ReadyForPickup } from "@/emails/ReadyForPickup";
import { StatusUpdate } from "@/emails/StatusUpdate";
import { money } from "@/lib/format";
import { statusInfo } from "@/lib/orders/status";
import type { OrderEmailData } from "./data";
import type { OutgoingEmail } from "./transport";

export const EMAIL_TEMPLATES = ["customer-receipt", "owner-new-order", "ready-for-pickup", "status-update"] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

/** Renders one of the order emails to HTML + plain text, with recipient and subject. */
export async function buildEmail(template: EmailTemplate, d: OrderEmailData, opts: { note?: string | null } = {}): Promise<OutgoingEmail> {
  let to = d.customerEmail;
  let replyTo: string | undefined = privateSite.ownerEmail;
  let subject: string;
  let node: React.ReactElement;

  switch (template) {
    case "customer-receipt":
      subject = `Your Coastline Prints order ${d.orderNumber} is confirmed`;
      node = <CustomerReceipt d={d} />;
      break;
    case "owner-new-order":
      to = privateSite.ownerEmail;
      replyTo = d.customerEmail;
      subject = `New order ${d.orderNumber}: ${money(d.totalCents)} from ${d.customerName}`;
      node = <OwnerNewOrder d={d} />;
      break;
    case "ready-for-pickup":
      subject = `Your order ${d.orderNumber} is ready for pickup`;
      node = <ReadyForPickup d={d} pickupWindowDays={legal.pickupWindowDays} />;
      break;
    case "status-update":
      subject = `Order ${d.orderNumber}: ${statusInfo(d.status).label}`;
      node = <StatusUpdate d={d} note={opts.note} />;
      break;
  }

  const html = await render(node);
  return { to, replyTo, subject, html, text: toPlainText(html) };
}
