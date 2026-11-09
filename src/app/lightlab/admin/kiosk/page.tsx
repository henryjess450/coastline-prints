import { KioskAdmin } from "@/components/kiosk/KioskAdmin";
import { kioskProblems, listKiosks, settleStaleKioskSales } from "@/lib/kiosk/server";

export const metadata = { title: "Kiosk" };

export default async function KioskAdminPage() {
  // A tablet that lost its connection mid-payment can't ring its sale up: catch those here.
  await settleStaleKioskSales();

  const [kiosks, problems] = await Promise.all([listKiosks(), kioskProblems()]);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Vancouver" });
  return (
    <KioskAdmin
      kiosks={kiosks.map((k) => {
        const todays = k.sales.filter((s) => s.createdAt.toLocaleDateString("en-CA", { timeZone: "America/Vancouver" }) === today);
        return { id: k.id, name: k.name, mode: k.mode === "order" ? "order" : "shop", lastSeen: k.lastSeenAt.toISOString(), salesToday: todays.length, centsToday: todays.reduce((n, s) => n + s.totalCents, 0), salesAll: k.sales.length };
      })}
      problems={problems.map((p) => ({ id: p.id, when: p.createdAt.toISOString(), totalCents: p.totalCents, email: p.email, problem: p.problem ?? "" }))}
    />
  );
}
