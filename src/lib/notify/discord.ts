import "server-only";
import { site } from "@config/site";
import { money } from "@/lib/format";
import type { OrderEmailData } from "@/lib/email/data";

/** Posts a new-order message to Discord. Only used when DISCORD_WEBHOOK_URL is set. */
export async function postDiscordNewOrder(d: OrderEmailData) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) throw new Error("DISCORD_WEBHOOK_URL is not set");
  const items = d.items.map((i) => `• ${i.fileName} × ${i.quantity}: ${i.material} ${i.colorName}, ${i.size} on ${i.printerName}`).join("\n");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: site.name,
      embeds: [
        {
          title: `New order ${d.orderNumber} · ${money(d.totalCents)}`,
          url: d.links.admin,
          color: 0x0e4471,
          description: items.slice(0, 3500),
          fields: [
            { name: "Customer", value: `${d.customerName}${d.returning ? ` (${d.returning})` : ""}\n${d.customerEmail}\n${d.customerPhone}`, inline: true },
            ...(d.discounts.length ? [{ name: "Codes used", value: d.discounts.map((x) => `${x.label}: -${money(x.amountCents)}`).join("\n"), inline: false }] : []),
            { name: "Estimate", value: `${d.totalGrams.toFixed(0)} g · ${d.totalHoursLabel}`, inline: true },
            d.shipTo
              ? { name: "Ship", value: `${d.shipTo.at(-2)}\n${d.shippingLabel ?? "Canada Post"}`, inline: true }
              : { name: "Pickup", value: d.pickupWhen ?? "Not booked", inline: true },
            ...(d.notes ? [{ name: "Notes", value: d.notes.slice(0, 1000) }] : []),
          ],
          timestamp: d.createdAt,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Discord webhook failed: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300));
}
