import { requireAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const [failedEmails, etransferReview] = await Promise.all([db.outboxJob.count({ where: { status: "FAILED" } }), db.etransferDeposit.count({ where: { status: "REVIEW" } })]);
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6">
      <AdminNav failedEmails={failedEmails} etransferReview={etransferReview} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
