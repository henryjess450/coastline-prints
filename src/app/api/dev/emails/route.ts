import { buildEmail, EMAIL_TEMPLATES, type EmailTemplate } from "@/lib/email/build";
import { loadOrderEmailData } from "@/lib/email/data";
import { db } from "@/lib/db";
import { renderGiftCardPng } from "@/lib/giftcards/card-image";
import { buildGiftEmail } from "@/lib/giftcards/emails";
import { GIFT_EMAIL_TEMPLATES, type GiftData, type GiftEmailTemplate } from "@/lib/giftcards/server";

/** Made-up gift for previews (not a real card). */
const SAMPLE_GIFT: GiftData = {
  id: "sample",
  amountCents: 5000,
  amount: "$50.00",
  buyerName: "Sam Rivera",
  buyerEmail: "sam@example.com",
  recipientName: "Jordan Lee",
  recipientEmail: "jordan@example.com",
  message: "Happy birthday! Print something awesome.",
  sendOn: "2026-10-12",
  deliverAt: new Date("2026-10-12T16:00:00Z"),
  number: "1234 5678 1234 5678",
  pin: "CP12345",
  receiptUrl: null,
  card: "VISA •••• 4242",
};

export const runtime = "nodejs";

/**
 * DEV ONLY email preview: /api/dev/emails?template=customer-receipt
 * (optionally &order=CP-XXXX-XXXX). Gift emails: template=gift-recipient,
 * gift-buyer, gift-owner, or gift-card-image for the card picture (sample
 * data, add &now=1 for a send-now gift). Returns 404 in production.
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const raw = url.searchParams.get("template") ?? "customer-receipt";
  const sample = { ...SAMPLE_GIFT, sendOn: url.searchParams.get("now") ? null : SAMPLE_GIFT.sendOn };
  if (raw === "gift-card-image") return new Response(new Uint8Array(await renderGiftCardPng(sample)), { headers: { "Content-Type": "image/png" } });
  if ((GIFT_EMAIL_TEMPLATES as readonly string[]).includes(raw)) {
    const email = await buildGiftEmail(raw as GiftEmailTemplate, sample);
    let html = email.html;
    for (const a of email.attachments ?? []) if (a.cid) html = html.replaceAll(`cid:${a.cid}`, `data:${a.contentType};base64,${a.content.toString("base64")}`);
    const meta = `<div style="font:13px monospace;background:#fff3c4;padding:8px 12px">To: ${email.to} · Reply-To: ${email.replyTo ?? "-"} · Subject: ${email.subject}</div>`;
    return new Response(meta + html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  const template = raw as EmailTemplate;
  if (!EMAIL_TEMPLATES.includes(template)) return new Response(`Templates: ${[...EMAIL_TEMPLATES, ...GIFT_EMAIL_TEMPLATES, "gift-card-image"].join(", ")}`, { status: 400 });
  const number = url.searchParams.get("order");
  const order = number ? await db.order.findUnique({ where: { orderNumber: number } }) : await db.order.findFirst({ orderBy: { createdAt: "desc" } });
  if (!order) return new Response("No orders yet. Run scripts/dev-fake-order.mts first.", { status: 404 });
  const data = (await loadOrderEmailData(order.id))!;
  const email = await buildEmail(template, data, { note: "Example note from the shop." });
  const meta = `<div style="font:13px monospace;background:#fff3c4;padding:8px 12px">To: ${email.to} · Reply-To: ${email.replyTo ?? "-"} · Subject: ${email.subject}</div>`;
  return new Response(meta + email.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
