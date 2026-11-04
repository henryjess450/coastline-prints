import { pickup } from "@config/pickup";
import { ReceiptsPanel } from "@/components/admin/receipts/ReceiptsPanel";
import { requireAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email/data";
import { bridgeKeyMadeAt, bridgePresence } from "@/lib/receipt/bridge";
import { printDestination } from "@/lib/receipt/print";
import { getPrintSettings, receiptSeason } from "@/lib/receipt/settings";

export const metadata = { title: "Receipts" };

/** The receipt printer away from home (the print bridge) and the LightLab stand's market and seasonal receipts. */
export default async function ReceiptsPage() {
  await requireAdmin();
  const [settings, keyMadeAt, jobs, destination] = await Promise.all([
    getPrintSettings(),
    bridgeKeyMadeAt(),
    db.printJob.findMany({ orderBy: { createdAt: "desc" }, take: 12, select: { id: true, label: true, status: true, error: true, createdAt: true } }),
    printDestination(),
  ]);
  const p = bridgePresence();
  return (
    <ReceiptsPanel
      settings={settings}
      seasonNow={await receiptSeason(settings)}
      bridge={{ online: p.online, agoMin: p.agoMin, printer: p.printer ?? null, printerHost: p.printerHost ?? null, version: p.version ?? null, keyMadeAt: keyMadeAt?.toISOString() ?? null }}
      destination={destination}
      homePrinter={process.env.RECEIPT_PRINTER_HOST || null}
      jobs={jobs.map((j) => ({ ...j, createdAt: new Intl.DateTimeFormat("en-CA", { timeZone: pickup.timeZone, hour: "numeric", minute: "2-digit" }).format(j.createdAt) }))}
      site={appUrl()}
    />
  );
}
