import { buildEmail, EMAIL_TEMPLATES, type EmailTemplate } from "@/lib/email/build";
import { loadOrderEmailData } from "@/lib/email/data";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * DEV ONLY email preview: /api/dev/emails?template=customer-receipt
 * (optionally &order=CP-XXXX-XXXX). Returns 404 in production.
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const template = (url.searchParams.get("template") ?? "customer-receipt") as EmailTemplate;
  if (!EMAIL_TEMPLATES.includes(template)) return new Response(`Templates: ${EMAIL_TEMPLATES.join(", ")}`, { status: 400 });
  const number = url.searchParams.get("order");
  const order = number ? await db.order.findUnique({ where: { orderNumber: number } }) : await db.order.findFirst({ orderBy: { createdAt: "desc" } });
  if (!order) return new Response("No orders yet. Run scripts/dev-fake-order.mts first.", { status: 404 });
  const data = (await loadOrderEmailData(order.id))!;
  const email = await buildEmail(template, data, { note: "Example note from the shop." });
  const meta = `<div style="font:13px monospace;background:#fff3c4;padding:8px 12px">To: ${email.to} · Reply-To: ${email.replyTo ?? "-"} · Subject: ${email.subject}</div>`;
  return new Response(meta + email.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
