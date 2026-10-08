/** The order pipeline, in order. Labels are what customers see. */
export const ORDER_STATUSES = [
  { id: "PAID", label: "Paid", customer: "We've received your order and payment." },
  { id: "QUEUED", label: "Queued", customer: "Your files are checked and waiting for a printer." },
  { id: "PRINTING", label: "Printing", customer: "Your parts are printing now." },
  { id: "POST_PROCESSING", label: "Post-processing", customer: "We're removing supports and cleaning up your parts." },
  { id: "READY_FOR_PICKUP", label: "Ready for pickup", customer: "Your order is ready to collect." },
  { id: "PICKED_UP", label: "Picked up", customer: "Your order has been collected. Enjoy!" },
] as const;

/**
 * Shipped orders use the same pipeline; the last two steps just read
 * differently (READY_FOR_PICKUP = shipped, PICKED_UP = delivered).
 */
const SHIPPED_LABELS: Partial<Record<string, { label: string; customer: string }>> = {
  READY_FOR_PICKUP: { label: "Shipped", customer: "Your order is on its way with Canada Post." },
  PICKED_UP: { label: "Delivered", customer: "Your order has been delivered. Enjoy!" },
};

export type OrderStatus = (typeof ORDER_STATUSES)[number]["id"];
export type Fulfillment = "PICKUP" | "SHIP" | (string & {});

export function statusInfo(id: string, fulfillment?: Fulfillment | null) {
  const base = ORDER_STATUSES.find((s) => s.id === id) ?? ORDER_STATUSES[0];
  const shipped = fulfillment === "SHIP" ? SHIPPED_LABELS[base.id] : undefined;
  return shipped ? { ...base, ...shipped } : base;
}

/** The pipeline with labels for this kind of order. */
export function orderStatuses(fulfillment?: Fulfillment | null) {
  return ORDER_STATUSES.map((s) => statusInfo(s.id, fulfillment));
}

export function statusIndex(id: string) {
  return Math.max(0, ORDER_STATUSES.findIndex((s) => s.id === id));
}

/** Canada Post's public tracking page for a tracking number. */
export function trackingUrl(trackingNumber: string) {
  return `https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=${encodeURIComponent(trackingNumber)}`;
}
