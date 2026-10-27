import { PosDisplay } from "@/components/pos/PosDisplay";

export const metadata = { title: "Register display", robots: { index: false, follow: false } };

/** The customer-facing tablet at the register. Pairs with /admin/pos by a code. */
export default function PosDisplayPage() {
  return <PosDisplay />;
}
