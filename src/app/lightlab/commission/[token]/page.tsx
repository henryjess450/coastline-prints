import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommissionStatus } from "@/components/lightlab/commission/CommissionStatus";
import { commissionPhotos, ensureEtransferCheckout, syncCommission, type CommissionStatus as Status } from "@/lib/commissions/server";
import { db } from "@/lib/db";
import { payLinksAvailable } from "@/lib/pos/paylink.server";

export const metadata: Metadata = { title: "Your lamp request", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CommissionRequestPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ sent?: string }> }) {
  const row = await db.lampCommission.findUnique({ where: { token: (await params).token } });
  if (!row) notFound();
  const c = await syncCommission(row);
  // Accepted: the e-Transfer code (made again if the last one lapsed).
  const co = c.status === "ACCEPTED" ? await ensureEtransferCheckout(c.id) : null;
  const order = c.orderId ? await db.order.findUnique({ where: { id: c.orderId }, select: { viewToken: true, orderNumber: true } }) : null;
  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
      <Link href="/lightlab" className="ll-link text-sm text-muted hover:text-fg">
        ← LightLab
      </Link>
      <CommissionStatus
        token={c.token}
        sent={(await searchParams).sent === "1"}
        c={{ status: c.status as Status, name: c.name, idea: c.idea, shade: c.shade, shadeHex: c.shadeHex, neededBy: c.neededBy, photos: commissionPhotos(c).length, quoteCents: c.quoteCents, quoteNote: c.quoteNote }}
        etransfer={co?.etransferCode && process.env.ETRANSFER_EMAIL ? { code: co.etransferCode, sendTo: process.env.ETRANSFER_EMAIL, amountCents: co.totalCents } : null}
        card={payLinksAvailable()}
        order={order}
      />
    </div>
  );
}
