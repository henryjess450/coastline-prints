import "server-only";
import { Img, Section, Text } from "@react-email/components";
import { render, toPlainText } from "@react-email/render";
import { lightlab } from "@config/lightlab";
import { shopConfig } from "@config/shops";
import { privateSite } from "@config/private.server";
import { accentFor, EmailLayout, H1, P, PillButton } from "@/emails/components/Layout";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email/data";
import type { OutgoingEmail } from "@/lib/email/transport";
import { money } from "@/lib/format";
import { toProductDto } from "./products.server";
import { inStock, unitPrice, variantOf } from "./types";

const accent = accentFor(true);

/** To the owner: a product (or option) is running low or just sold out. Null if it's gone. */
export async function buildStockAlertEmail(payload: { productId?: string; variantId?: string; left?: number }): Promise<OutgoingEmail | null> {
  const row = await db.shopProduct.findUnique({ where: { id: payload.productId ?? "" } });
  if (!row) return null;
  const p = toProductDto(row);
  const option = variantOf(p, payload.variantId || null);
  const label = option ? `${p.name} (${option.name})` : p.name;
  const left = payload.left ?? 0;
  const waiting = left === 0 ? await db.restockRequest.count({ where: { productId: p.id, notifiedAt: null } }) : 0;
  const subject = left === 0 ? `${label} just sold out` : `${label}: only ${left} left`;
  const shop = shopConfig(p.shop);
  const ll = shop.id === "lightlab";
  const html = await render(
    <EmailLayout brand={ll ? "lightlab" : "coastline"} preview={subject} footerNote={`${ll ? "LightLab" : "Shop"} stock alert. Not sent to customers.`}>
      <H1>{subject}</H1>
      <P muted>
        {left === 0
          ? "It's showing as sold out on the shop now. When you restock, people who asked to be told get an email straight away."
          : `It's still on sale. You get another email if it sells out.`}
      </P>
      {waiting > 0 && <P>{waiting === 1 ? "1 person is" : `${waiting} people are`} already waiting to hear when it&apos;s back.</P>}
      <Section style={{ margin: "18px 0 4px" }}>
        <PillButton accent={ll ? accent : undefined} href={`${appUrl()}${shop.admin}/products/${p.id}`}>
          Update stock
        </PillButton>
      </Section>
    </EmailLayout>,
  );
  return { to: privateSite.ownerEmail, subject, html, text: toPlainText(html) };
}

/** To a shopper who asked: the product they wanted is back. Null if it isn't any more (skipped, not failed). */
export async function buildRestockEmail(payload: { requestId?: string }): Promise<OutgoingEmail | null> {
  const req = await db.restockRequest.findUnique({ where: { id: payload.requestId ?? "" }, include: { product: true } });
  if (!req || !req.product.active) return null;
  const p = toProductDto(req.product);
  const variantId = req.variantId || null;
  if (variantId && !variantOf(p, variantId)) return null;
  if (inStock(p, variantId) === 0) return null;
  const option = variantOf(p, variantId);
  const label = option ? `${p.name} (${option.name})` : p.name;
  const url = `${appUrl()}/lightlab/${p.slug}`;
  const subject = `${label} is back at LightLab`;
  const html = await render(
    <EmailLayout brand="lightlab" preview={`${label} is back in stock. ${money(unitPrice(p, variantId))}`} footerNote={`You asked ${lightlab.name} to tell you when this was back. This is the only email you'll get about it.`}>
      <H1>It&apos;s back: {label}</H1>
      <P muted>You asked us to let you know, so here it is: it&apos;s in stock now.</P>
      {p.images[0] && <Img src={`${appUrl()}${p.images[0]}`} alt={p.name} width={260} style={{ display: "block", width: 260, height: "auto", borderRadius: 16, margin: "10px 0 14px" }} />}
      <Text style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 700, color: accent.brand }}>{money(unitPrice(p, variantId))}</Text>
      <PillButton accent={accent} href={url}>
        Get yours
      </PillButton>
    </EmailLayout>,
  );
  return { to: req.email, replyTo: privateSite.ownerEmail, subject, html, text: toPlainText(html) };
}

/**
 * After the owner changes stock: email everyone waiting on something that's
 * now in stock (once each). Returns how many were queued.
 */
export async function queueRestockEmails(productId: string) {
  const row = await db.shopProduct.findUnique({ where: { id: productId }, include: { restockRequests: { where: { notifiedAt: null } } } });
  if (!row || !row.active || !row.restockRequests.length) return 0;
  const p = toProductDto(row);
  const ready = row.restockRequests.filter((r) => {
    const v = r.variantId || null;
    return (!v || variantOf(p, v)) && inStock(p, v) !== 0;
  });
  if (!ready.length) return 0;
  await db.$transaction([
    ...ready.map((r) => db.outboxJob.create({ data: { kind: "email", template: "lightlab-back-in-stock", payload: JSON.stringify({ orderId: "", requestId: r.id }), dedupeKey: `restock:${r.id}` } })),
    db.restockRequest.updateMany({ where: { id: { in: ready.map((r) => r.id) } }, data: { notifiedAt: new Date() } }),
  ]);
  return ready.length;
}
