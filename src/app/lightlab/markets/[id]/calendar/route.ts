import { lightlab } from "@config/lightlab";
import { pickup } from "@config/pickup";
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

/** One market as a calendar event (.ics), from the "Find us at" list. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const m = await db.market.findUnique({ where: { id } });
  if (!m) return new Response("Not found", { status: 404 });
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${lightlab.name}//Markets//EN`,
    "BEGIN:VEVENT",
    `UID:market-${m.id}@lightlab`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(zoned(m.date, m.startTime, pickup.timeZone))}`,
    `DTEND:${stamp(zoned(m.date, m.endTime, pickup.timeZone))}`,
    `SUMMARY:${esc(`${lightlab.name} at ${m.name}`)}`,
    `LOCATION:${esc([m.place, m.address].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${esc([m.note, m.url].filter(Boolean).join("\n") || "Come say hi!")}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
  return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="lightlab-${m.date}.ics"` } });
}
