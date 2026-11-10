import { CommissionsAdmin, type AdminCommission } from "@/components/lightlab/commission/CommissionsAdmin";
import { commissionPhotos, commissionPhotoUrl, syncCommission } from "@/lib/commissions/server";
import { db } from "@/lib/db";

export const metadata = { title: "Commissions" };
export const dynamic = "force-dynamic";

export default async function CommissionsAdminPage() {
  const rows = await db.lampCommission.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  // Payments that landed since: shown as paid.
  const fresh = await Promise.all(rows.map((r) => (r.status === "ACCEPTED" ? syncCommission(r) : r)));
  const orders = new Map((await db.order.findMany({ where: { id: { in: fresh.map((r) => r.orderId).filter((x): x is string => !!x) } }, select: { id: true, orderNumber: true } })).map((o) => [o.id, o.orderNumber]));
  const list: AdminCommission[] = fresh.map((r) => ({
    id: r.id,
    token: r.token,
    status: r.status,
    name: r.name,
    email: r.email,
    phone: r.phone,
    idea: r.idea,
    shade: r.shade,
    shadeHex: r.shadeHex,
    neededBy: r.neededBy,
    photos: commissionPhotos(r).map(commissionPhotoUrl),
    quoteCents: r.quoteCents,
    quoteNote: r.quoteNote,
    createdAt: r.createdAt.toISOString(),
    orderId: r.orderId,
    orderNumber: r.orderId ? (orders.get(r.orderId) ?? null) : null,
  }));
  return <CommissionsAdmin list={list} />;
}
