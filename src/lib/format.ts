export const mm = (v: number, d = 1) => `${v.toFixed(d)} mm`;

export function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
export const money = (cents: number) => cad.format(cents / 100);

export function hours(h: number) {
  const totalMin = Math.max(1, Math.round(h * 60));
  const hh = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return hh ? `${hh}h ${String(m).padStart(2, "0")}m` : `${m} min`;
}
