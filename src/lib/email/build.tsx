import "server-only";
import { render, toPlainText } from "@react-email/render";
import { legal } from "@config/site";
import { privateSite } from "@config/private.server";
import { CustomerReceipt } from "@/emails/CustomerReceipt";
import { OwnerNewOrder } from "@/emails/OwnerNewOrder";
import { ReadyForPickup } from "@/emails/ReadyForPickup";
import { Shipped } from "@/emails/Shipped";
import { StatusUpdate } from "@/emails/StatusUpdate";
import { money } from "@/lib/format";
import { statusInfo } from "@/lib/orders/status";
import type { OrderEmailData } from "./data";
import type { OutgoingEmail } from "./transport";

export const EMAIL_TEMPLATES = ["customer-receipt", "owner-new-order", "ready-for-pickup", "shipped", "status-update"] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

/** Renders one of the order emails to HTML + plain text, with recipient and subject. */
export async function buildEmail(template: EmailTemplate, d: OrderEmailData, opts: { note?: string | null } = {}): Promise<OutgoingEmail> {
  let to = d.customerEmail;
  let replyTo: string | undefined = privateSite.ownerEmail;
  let subject: string;
  let node: React.ReactElement;

  // A shipped order must never get the pickup-address email, whatever was queued.
  if (template === "ready-for-pickup" && d.fulfillment === "SHIP") template = "shipped";

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
    case "shipped":
      subject = `Your order ${d.orderNumber} has shipped`;
      node = <Shipped d={d} note={opts.note} />;
      break;
    case "status-update":
      subject = `Order ${d.orderNumber}: ${statusInfo(d.status, d.fulfillment).label}`;
      node = <StatusUpdate d={d} note={opts.note} />;
      break;
  }

  const html = await render(node);
  return { to, replyTo, subject, html, text: toPlainText(html) };
}
