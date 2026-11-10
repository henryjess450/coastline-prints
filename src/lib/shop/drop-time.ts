/** Drop dates are typed and shown in the shop's time zone, whatever the server's or browser's is. */
export const SHOP_TZ = "America/Vancouver";

/** Minutes the shop's clock is ahead of UTC at a moment (negative in Victoria). */
function offsetMinutes(at: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: SHOP_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(at).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** ISO time → "YYYY-MM-DDTHH:mm" on the shop's clock (for a datetime-local box). */
export function toShopLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const local = new Date(d.getTime() + offsetMinutes(d) * 60_000);
  return local.toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" on the shop's clock → ISO time. Empty → null. */
export function fromShopLocal(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const guess = new Date(`${local}:00Z`);
  // Twice, so a guess on the far side of a daylight-saving change settles.
  let t = guess.getTime() - offsetMinutes(guess) * 60_000;
  t = guess.getTime() - offsetMinutes(new Date(t)) * 60_000;
  return new Date(t).toISOString();
}

/** "Fri, Nov 20, 7:00 p.m." on the shop's clock. */
export const dropLabel = (iso: string) => new Date(iso).toLocaleString("en-CA", { timeZone: SHOP_TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Nov 20" on the shop's clock. Same on the server and in the browser. */
export function dropShort(iso: string) {
  const [, m, d] = toShopLocal(iso).slice(0, 10).split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}
