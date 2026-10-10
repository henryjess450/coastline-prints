import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { loadInvoice } from "@/lib/invoice/data";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

/**
 * The invoice for one order, on the web: the same details as the PDF that's
 * emailed with the receipt, with a button to download it. Reached by the
 * order's private link. Never shows the pickup address.
 */
export default async function InvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{20,64}$/.test(token)) notFound();
  const d = await loadInvoice({ viewToken: token });
  if (!d) notFound();
  const qr = await QRCode.toString(d.url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });

  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <a href={`/orders/${d.viewToken}`} className="text-sm text-muted hover:text-fg">
          ← Back to the order
        </a>
        <a href={`/orders/${d.viewToken}/invoice/pdf`} className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-transform active:scale-95">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
          </svg>
          Download PDF
        </a>
      </div>

      <article className="rounded-3xl border border-line bg-surface p-6 sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
          <div>
            <p className="font-display text-2xl font-bold">{d.business.name}</p>
            <p className="text-sm text-muted">{d.business.email}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.16em] text-faint">Invoice</p>
            <p className="font-mono text-lg font-semibold">{d.orderNumber}</p>
            <p className="text-sm text-muted">{d.date}</p>
          </div>
        </header>

        <div className="grid gap-6 border-b border-line py-6 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-faint">Billed to</p>
            <p className="mt-1 font-medium">{d.customer.name}</p>
            <p className="text-muted">{d.customer.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-faint">{d.delivery.kind === "ship" ? "Shipped to" : "Pickup"}</p>
            {d.delivery.kind === "ship" ? d.delivery.lines.map((l) => <p key={l} className="mt-0.5 first:mt-1">{l}</p>) : <p className="mt-1">{d.delivery.when}</p>}
          </div>
        </div>

        <table className="w-full text-sm">
          <tbody className="divide-y divide-line">
            {d.items.map((it, i) => (
              <tr key={i}>
                <td className="py-3 pr-4">
                  <span className="font-medium">
                    {it.name} × {it.quantity}
                  </span>
                  <span className="block text-xs text-muted">{it.detail}</span>
                </td>
                <td className="whitespace-nowrap py-3 text-right font-mono">{money(it.cents)}</td>
              </tr>
            ))}
            {d.extras.map((e, i) => (
              <tr key={`e${i}`}>
                <td className="py-3 pr-4">{e.label}</td>
                <td className={`whitespace-nowrap py-3 text-right font-mono ${e.minus ? "text-success" : ""}`}>{e.minus ? `−${money(e.cents)}` : money(e.cents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line-strong">
              <td className="pt-4">
                <span className="mr-3 inline-block -rotate-3 rounded-md border-2 border-success px-2 py-0.5 text-xs font-bold tracking-widest text-success">PAID</span>
                <span className="font-display text-lg font-bold">Total paid</span>
              </td>
              <td className="pt-4 text-right font-mono text-lg font-bold">{money(d.totalCents)}</td>
            </tr>
            <tr>
              <td className="pt-1 text-right text-muted" colSpan={2}>
                Paid by {d.paidBy}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-8 flex items-center gap-4 border-t border-line pt-6">
          {/* The same QR code as on the PDF and the printed receipt: it opens the order online. */}
          <span className="block h-20 w-20 shrink-0 rounded-lg bg-white p-1.5 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="text-xs text-faint">Scan to see your order, its status and this invoice online. Thanks for printing with {d.business.name}. Prices in Canadian dollars.</p>
        </div>
      </article>
    </div>
  );
}
