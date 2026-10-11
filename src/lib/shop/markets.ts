/** Market dates for "Find us at". Shared by the shop page, the admin and the calendar file. */

export type MarketDto = { id: string; name: string; place: string; address: string; date: string; startTime: string; endTime: string; note: string; url: string };

/** "9:00" → "9 am", "13:30" → "1:30 pm". */
export function clock(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
}

/** "9 am to 1 pm" */
export const hours = (m: Pick<MarketDto, "startTime" | "endTime">) => `${clock(m.startTime)} to ${clock(m.endTime)}`;

/** "YYYY-MM-DD" → { weekday: "Sat", month: "Oct", day: 18 } (no time zone shifts: it's a calendar date). */
export function dayParts(date: string) {
  const [y, mo, d] = date.split("-").map(Number);
  const at = new Date(Date.UTC(y, mo - 1, d, 12));
  return {
    weekday: at.toLocaleDateString("en-CA", { weekday: "short", timeZone: "UTC" }),
    month: at.toLocaleDateString("en-CA", { month: "short", timeZone: "UTC" }).replace(".", ""),
    day: d,
    long: at.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }),
  };
}

export const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
