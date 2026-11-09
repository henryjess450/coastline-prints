import { createSignInLink } from "@/lib/account/link";
import { buildEmail, EMAIL_TEMPLATES, type EmailTemplate } from "@/lib/email/build";
import { loadOrderEmailData, marketWhen, type OrderEmailData } from "@/lib/email/data";
import { upcomingMarkets } from "@/lib/shop/markets.server";
import { shopImageUrl } from "@/lib/shop/types";
import { db } from "@/lib/db";
import { renderGiftCardPng } from "@/lib/giftcards/card-image";
import { designOf } from "@/lib/giftcards/designs";
import { buildGiftEmail } from "@/lib/giftcards/emails";
import { GIFT_EMAIL_TEMPLATES, type GiftData, type GiftEmailTemplate } from "@/lib/giftcards/server";

/** Made-up gift for previews (not a real card). */
const SAMPLE_GIFT: GiftData = {
  id: "sample",
  amountCents: 5000,
  amount: "$50.00",
  paid: "$50.00",
  bonus: null,
  design: "coastline",
  revealUrl: "http://localhost:3000/gift/sample",
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
 * (optionally &order=CP-XXXX-XXXX, and &signin=1 for the register-order receipt
 * with its sign-in button). Gift emails: template=gift-recipient,
 * gift-buyer, gift-owner, or gift-card-image for the card picture (sample
 * data, add &now=1 for a send-now gift, &bonus=1 for a $5 holiday bonus,
 * &design=holiday|lightlab|both for the other card designs).
 * The review request email is at /dev/review-email. Returns 404 in production.
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const raw = url.searchParams.get("template") ?? "customer-receipt";
  const bonus = url.searchParams.get("bonus") ? { amountCents: 5500, amount: "$55.00", bonus: "$5.00" } : {};
  const sample = { ...SAMPLE_GIFT, ...bonus, design: designOf(url.searchParams.get("design")), sendOn: url.searchParams.get("now") ? null : SAMPLE_GIFT.sendOn };
  if (raw === "gift-card-image") return new Response(new Uint8Array(await renderGiftCardPng(sample)), { headers: { "Content-Type": "image/png" } });
  if ((GIFT_EMAIL_TEMPLATES as readonly string[]).includes(raw)) {
    const email = await buildGiftEmail(raw as GiftEmailTemplate, sample);
    let html = email.html;
    for (const a of email.attachments ?? []) if (a.cid) html = html.replaceAll(`cid:${a.cid}`, `data:${a.contentType};base64,${a.content.toString("base64")}`);
    const meta = `<div style="font:13px monospace;background:#fff3c4;padding:8px 12px">To: ${email.to} · Reply-To: ${email.replyTo ?? "-"} · Subject: ${email.subject}</div>`;
    return new Response(meta + html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  // LightLab designs with made-up orders: &sample=ll-online (website order) or ll-stand (stand or kiosk sale).
  const sampleKind = url.searchParams.get("sample");
  if (sampleKind === "ll-online" || sampleKind === "ll-stand") {
    const data = await lightlabSample(sampleKind === "ll-stand", url.searchParams.get("ship") === "1", url.origin);
    const email = await buildEmail("customer-receipt", data, {});
    const meta = `<div style="font:13px monospace;background:#fff3c4;padding:8px 12px">To: ${email.to} · Subject: ${email.subject}</div>`;
    return new Response(meta + email.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  const template = raw as EmailTemplate;
  if (!EMAIL_TEMPLATES.includes(template)) return new Response(`Templates: ${[...EMAIL_TEMPLATES, ...GIFT_EMAIL_TEMPLATES, "gift-card-image"].join(", ")}`, { status: 400 });
  const number = url.searchParams.get("order");
  const order = number ? await db.order.findUnique({ where: { orderNumber: number } }) : await db.order.findFirst({ orderBy: { createdAt: "desc" } });
  if (!order) return new Response("No orders yet. Run scripts/dev-fake-order.mts first.", { status: 404 });
  const data = (await loadOrderEmailData(order.id))!;
  const signInUrl = url.searchParams.get("signin") ? await createSignInLink(data.customerEmail, new URL(data.links.confirmation).pathname) : undefined;
  const email = await buildEmail(template, data, { note: "Example note from the shop.", signInUrl });
  const meta = `<div style="font:13px monospace;background:#fff3c4;padding:8px 12px">To: ${email.to} · Reply-To: ${email.replyTo ?? "-"} · Subject: ${email.subject}</div>`;
  return new Response(meta + email.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/** A made-up LightLab order using the shop's real products and photos. */
async function lightlabSample(stand: boolean, ship: boolean, origin: string): Promise<OrderEmailData> {
  // Photos from this server, so the preview shows this computer's products.
  const base = origin;
  const products = await db.shopProduct.findMany({ where: { shop: "lightlab", active: true }, take: 2, orderBy: { sortOrder: "asc" } });
  const items = products.map((p, i) => {
    const keys = JSON.parse(p.images) as string[];
    return { fileName: p.name, quantity: 1, material: "LightLab", colorName: i ? "" : "Red cap", quality: "", infill: "", size: "", printerName: "", grams: 0, hoursLabel: "", lineCents: p.priceCents, product: true, image: keys[0] ? `${base}${shopImageUrl(keys[0])}` : null };
  });
  const subtotal = items.reduce((s, i) => s + i.lineCents, 0);
  const next = (await upcomingMarkets(1))[0];
  return {
    lightlab: true, products: true, inPerson: stand, source: stand ? "LightLab market stall" : null,
    nextMarket: next ? { name: next.name, when: marketWhen(next) } : { name: "Holiday Craft Fair", when: "Saturday, November 28 · 10 am to 4 pm" },
    orderId: "sample", orderNumber: "LL-2611-SAMP", status: stand ? "PICKED_UP" : "PAID", createdAt: new Date().toISOString(),
    customerName: "Sam Rivera", customerEmail: "sam@example.com", customerPhone: "", notes: null, items,
    baseFeeCents: 0, minimumAdjCents: 0, discounts: stand ? [] : [{ label: "Coupon 1234 5678 9012 (5% off)", amountCents: Math.round(subtotal * 0.05) }],
    returning: null, totalCents: stand ? subtotal : subtotal - Math.round(subtotal * 0.05) + (ship ? 1650 : 0), totalGrams: 0, totalHoursLabel: "",
    card: stand ? "Visa ending 4242" : "Apple Pay (Visa ending 4242)", fulfillment: ship ? "SHIP" : "PICKUP",
    pickupAddress: ship ? null : "123 Example St, Victoria, BC", atMarket: false, shippingCents: ship ? 1650 : 0,
    shipTo: ship ? ["Sam Rivera", "456 Sample Rd", "Victoria BC  V8V 1A1"] : null, shippingLabel: ship ? "Canada Post · Expedited" : null,
    tracking: null, tracked: true, pickupWhen: ship ? null : "Friday, November 13, 4 to 5 pm",
    links: { confirmation: `${base}/orders/sample`, status: `${base}/status`, admin: `${base}/admin`, invoice: `${base}/orders/sample/invoice`, receipt: null },
  };
}
