import "server-only";
import { render, toPlainText } from "@react-email/render";
import { privateSite } from "@config/private.server";
import { GiftCardBuyer, GiftCardOwner, GiftCardRecipient } from "@/emails/GiftCard";
import type { OutgoingEmail } from "@/lib/email/transport";
import { renderGiftCardPng } from "./card-image";
import { friendlyDate } from "./rules";
import type { GiftData, GiftEmailTemplate } from "./server";

/** Renders one of the gift card emails, with the card picture attached inline. */
export async function buildGiftEmail(template: GiftEmailTemplate, g: GiftData): Promise<OutgoingEmail> {
  const when = g.sendOn ? friendlyDate(g.sendOn) : null;
  const orderUrl = `${(process.env.APP_URL ?? "https://coastlineprints.ca").replace(/\/$/, "")}/order`;
  let to: string;
  let subject: string;
  let replyTo: string | undefined = privateSite.ownerEmail;
  let node: React.ReactElement;
  let withCard = true;

  switch (template) {
    case "gift-recipient":
      to = g.recipientEmail;
      subject = `${g.buyerName.split(/\s+/)[0]} sent you a ${g.amount} Coastline Prints gift card`;
      node = <GiftCardRecipient g={g} orderUrl={orderUrl} redeemUrl={orderUrl.replace(/\/order$/, "/redeem")} />;
      break;
    case "gift-buyer":
      to = g.buyerEmail;
      subject = when ? `Your gift card for ${g.recipientName} is scheduled for ${when}` : `Your gift card for ${g.recipientName} is on its way`;
      node = <GiftCardBuyer g={g} when={when} />;
      break;
    case "gift-owner":
      to = privateSite.ownerEmail;
      replyTo = g.buyerEmail;
      subject = `Gift card sold: ${g.amount} from ${g.buyerName}`;
      node = <GiftCardOwner g={g} when={when} />;
      withCard = false;
      break;
  }

  const html = await render(node);
  const attachments = withCard ? [{ filename: "coastline-prints-gift-card.png", content: await renderGiftCardPng(g), contentType: "image/png", cid: "giftcard" }] : undefined;
  return { to, replyTo, subject, html, text: toPlainText(html), attachments };
}
