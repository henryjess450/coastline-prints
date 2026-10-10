import { ScanStation } from "@/components/admin/ScanStation";
import { requireAdmin } from "@/lib/admin/auth";

export const metadata = { title: "Scan station" };

/** Open this on the computer the barcode scanner is plugged into, and leave it open. */
export default async function ScanPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="font-display text-3xl font-bold">Scan station</h1>
        <p className="text-sm text-muted">Each scan moves the order to its next step and prints a stub. Ready for pickup and shipped email the customer, like the buttons do. Keep this page open with the scan box selected.</p>
      </div>
      <ScanStation />
    </div>
  );
}
