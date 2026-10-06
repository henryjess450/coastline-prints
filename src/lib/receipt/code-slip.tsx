import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { pickup } from "@config/pickup";
import { legal, site } from "@config/site";
import { formatCardNumber } from "@/lib/codes/apply";
import type { PromoCode } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { RECEIPT_WIDTH } from "./render";

/**
 * Printed gift card and coupon slips, laid out like the owner's design:
 * hand-lettered heading, black panel with the number / PIN / amount,
 * "Can be redeemed at:" + QR code, "Questions or concerns?" + email.
 *
 * Hand lettering: drop transparent PNGs into public/brand/lettering/
 *   coastline-prints.png  gift-card.png  coupon.png  redeem.png  questions.png
 * Any that are missing are drawn in bold type instead.
 */

const root = () => process.cwd();
const dataUri = (file: string) => `data:image/png;base64,${readFileSync(file).toString("base64")}`;

function lettering(name: string): { src: string; w: number; h: number } | null {
  const file = path.resolve(/* turbopackIgnore: true */ root(), "public/brand/lettering", `${name}.png`);
  if (!existsSync(file)) return null;
  const buf = readFileSync(file);
  // PNG header: width/height at bytes 16-23.
  return { src: dataUri(file), w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function montserrat() {
  const dir = path.resolve(/* turbopackIgnore: true */ root(), "assets/fonts");
  return [
    { name: "Montserrat", data: readFileSync(path.join(dir, "montserrat-latin-400-normal.woff")), weight: 400 as const, style: "normal" as const },
    { name: "Montserrat", data: readFileSync(path.join(dir, "montserrat-latin-600-normal.woff")), weight: 600 as const, style: "normal" as const },
  ];
}

const fmtDate = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: pickup.timeZone, month: "long", day: "numeric", year: "numeric" }).format(d);

/**
 * The lettering PNGs were all cut from the same 2000 px design canvas, so one
 * shared scale keeps every word the same letter size as in the design.
 */
const LETTERING_SCALE = 0.285;

/** A lettering image at the shared scale, or bold text if the image isn't there yet. */
function Heading({ name, text, height, grey = false }: { name: string; text: string; height: number; grey?: boolean }) {
  const img = lettering(name);
  if (img) {
    const w = Math.min(RECEIPT_WIDTH - 16, Math.round(img.w * LETTERING_SCALE));
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={img.src} width={w} height={Math.round((w / img.w) * img.h)} alt={text} />;
  }
  return <div style={{ display: "flex", fontSize: height * 0.62, fontWeight: 600, color: grey ? "#5a5a5a" : "black" }}>{text}</div>;
}

type SlipCode = Pick<PromoCode, "code" | "kind" | "pin" | "percentOff" | "amountCents" | "initialCents" | "minOrderCents" | "maxUses" | "expiresAt">;

export async function renderCodeSlipPng(codeId: string) {
  const c = await db.promoCode.findUnique({ where: { id: codeId } });
  if (!c) throw new Error(`Code ${codeId} not found`);
  return renderSlip(c);
}

/** Example slips with placeholder numbers, for previewing the design (nothing is saved). */
export function renderSampleSlipPng(kind: "gift" | "coupon") {
  const base = { pin: null, percentOff: null, amountCents: null, initialCents: null, minOrderCents: 0, maxUses: null, expiresAt: null };
  return renderSlip(
    kind === "gift"
      ? { ...base, code: "1234567812345678", kind: "GIFT_CARD", pin: "CP12345", initialCents: 2500 }
      : { ...base, code: "123456781234", kind: "AMOUNT", amountCents: 500, maxUses: 1 },
  );
}

async function renderSlip(c: SlipCode) {
  const gift = c.kind === "GIFT_CARD";

  const redeemUrl = `${(process.env.APP_URL ?? "https://coastlineprints.ca").replace(/\/$/, "")}/order`;
  const qr = await QRCode.toString(redeemUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  const qrSrc = `data:image/svg+xml;base64,${Buffer.from(qr).toString("base64")}`;

  const amount = c.kind === "PERCENT" ? `${c.percentOff}% off` : money((gift ? c.initialCents : c.amountCents) ?? 0);
  const conditions = [
    c.minOrderCents > 0 ? `On orders of ${money(c.minOrderCents)} or more` : null,
    !gift && c.maxUses === 1 ? "One-time use" : null,
    c.expiresAt ? `Valid until ${fmtDate(c.expiresAt)}` : null,
  ].filter(Boolean) as string[];

  // Title: one-line hand lettering if provided, else the two-line wordmark.
  const title = lettering("coastline-prints");
  const wordmark = dataUri(path.resolve(/* turbopackIgnore: true */ root(), "public/brand/wordmark-black.png"));
  const line = { display: "flex", justifyContent: "center", whiteSpace: "nowrap" } as const;
  // Numbers: large, semibold and spaced out so they read easily on thermal paper.
  const big = { fontSize: 40, fontWeight: 600, letterSpacing: 1.5, lineHeight: 1.15 } as const;

  const tree = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", height: "100%", background: "white", color: "black", fontFamily: "Montserrat", padding: "6px 4px" }}>
      {title ? (
        <Heading name="coastline-prints" text={site.name} height={60} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={wordmark} width={204} height={120} alt={site.name} />
      )}
      <div style={{ display: "flex", marginTop: 4 }}>
        <Heading name={gift ? "gift-card" : "coupon"} text={gift ? "Gift Card" : "Coupon"} height={76} grey />
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch", background: "black", color: "white", borderRadius: 34, padding: "20px 12px 22px", marginTop: 18 }}>
        {/* Each number on its own line, big and bold, with a small label above */}
        <div style={{ ...line, fontSize: 20 }}>{gift ? "Giftcard Number" : "Coupon Number"}</div>
        <div style={{ ...line, ...big }}>{formatCardNumber(c.code)}</div>
        {gift && c.pin && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 14 }}>
            <div style={{ ...line, fontSize: 20 }}>Giftcard Pin</div>
            <div style={{ ...line, ...big }}>{c.pin}</div>
          </div>
        )}
        <div style={{ ...line, fontSize: 20, marginTop: 18 }}>Amount</div>
        <div style={{ ...line, ...big }}>{amount}</div>
      </div>
      {conditions.length > 0 && <div style={{ ...line, fontSize: 17, marginTop: 8 }}>{conditions.join("  ·  ")}</div>}

      <div style={{ display: "flex", marginTop: 20 }}>
        <Heading name="redeem" text="Can be redeemed at:" height={50} />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrSrc} width={176} height={176} alt={redeemUrl} style={{ marginTop: 10 }} />
      <div style={{ ...line, fontSize: 18, marginTop: 6 }}>{redeemUrl.replace(/^https?:\/\//, "")}</div>

      <div style={{ display: "flex", marginTop: 22 }}>
        <Heading name="questions" text="Questions or concerns?" height={50} />
      </div>
      <div style={{ ...line, fontSize: 27, marginTop: 4 }}>{legal.contactEmail}</div>
    </div>
  );

  const res = new ImageResponse(tree, { width: RECEIPT_WIDTH, height: 1100, fonts: montserrat() });
  return { png: Buffer.from(await res.arrayBuffer()), code: c.code };
}
