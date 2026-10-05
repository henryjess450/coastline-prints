/** The order pipeline, in order. Labels are what customers see. */
export const ORDER_STATUSES = [
  { id: "PAID", label: "Paid", customer: "We've received your order and payment." },
  { id: "QUEUED", label: "Queued", customer: "Your files are checked and waiting for a printer." },
  { id: "PRINTING", label: "Printing", customer: "Your parts are printing now." },
  { id: "POST_PROCESSING", label: "Post-processing", customer: "We're removing supports and cleaning up your parts." },
  { id: "READY_FOR_PICKUP", label: "Ready for pickup", customer: "Your order is ready to collect." },
  { id: "PICKED_UP", label: "Picked up", customer: "Your order has been collected. Enjoy!" },
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number]["id"];

export function statusInfo(id: string) {
  return ORDER_STATUSES.find((s) => s.id === id) ?? ORDER_STATUSES[0];
}

export function statusIndex(id: string) {
  return Math.max(0, ORDER_STATUSES.findIndex((s) => s.id === id));
}
