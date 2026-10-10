import { pickup } from "@config/pickup";
import { privateSite } from "@config/private.server";
import { site } from "@config/site";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** The UTC instant of a wall-clock time in the shop's time zone. */
function zoned(date: string, time: string, timeZone: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(guess).map((p) => [p.type, p.value]));
  const seen = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return new Date(guess - (seen - guess));
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

/**
 * The pickup slot as a calendar event (.ics), from the order's private link.
 * Includes the pickup address, which this link already shows.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[\w-]{20,64}$/.test(token)) return new Response("Not found", { status: 404 });
  const order = await db.order.findUnique({ where: { viewToken: token } });
  if (!order || order.fulfillment === "SHIP" || !order.pickupDate || !order.pickupTime) return new Response("Not found", { status: 404 });

  const start = zoned(order.pickupDate, order.pickupTime, pickup.timeZone);
  const end = new Date(start.getTime() + pickup.slotMinutes * 60_000);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${site.name}//Pickup//EN`,
    "BEGIN:VEVENT",
    `UID:${order.id}@coastlineprints`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`Pick up ${site.name} order ${order.orderNumber}`)}`,
    `LOCATION:${esc(privateSite.pickupAddress)}`,
    `DESCRIPTION:${esc(`Bring your order number, ${order.orderNumber}. Need a different time? Reply to your receipt email.`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="pickup-${order.orderNumber}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
