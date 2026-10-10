import type { OrderStatus } from "./status";

/**
 * The one thing to do next with an order, in plain words, for the admin's
 * one-tap button. Ready and shipped email the customer, so those ask for a
 * second tap; tracked parcels can take a tracking number on the way.
 */
export type NextStep = {
  to: OrderStatus;
  /** Button text: "Start printing". */
  label: string;
  /** Said after it's done: "Printing". */
  done: string;
  /** The customer gets an email, so ask for a second tap first. */
  emails: boolean;
  /** Ask for a Canada Post tracking number (tracked parcels only). */
  tracking: boolean;
};

export function nextStep(status: string, fulfillment: string | null | undefined, tracked = true): NextStep | null {
  const ships = fulfillment === "SHIP";
  switch (status) {
    case "PAID":
      return { to: "QUEUED", label: "Files look good", done: "Queued", emails: false, tracking: false };
    case "QUEUED":
      return { to: "PRINTING", label: "Start printing", done: "Printing", emails: false, tracking: false };
    case "PRINTING":
      return { to: "POST_PROCESSING", label: "Done printing", done: "Cleaning up", emails: false, tracking: false };
    case "POST_PROCESSING":
      return ships
        ? { to: "READY_FOR_PICKUP", label: "Mark shipped", done: "Shipped", emails: true, tracking: tracked }
        : { to: "READY_FOR_PICKUP", label: "Ready for pickup", done: "Ready", emails: true, tracking: false };
    case "READY_FOR_PICKUP":
      return ships
        ? { to: "PICKED_UP", label: "Delivered", done: "Delivered", emails: false, tracking: false }
        : { to: "PICKED_UP", label: "Picked up", done: "Picked up", emails: false, tracking: false };
    default:
      return null;
  }
}

/** The board's columns, left to right. */
export const BOARD = [
  { id: "todo", title: "To print", statuses: ["PAID", "QUEUED"] },
  { id: "printing", title: "Printing", statuses: ["PRINTING"] },
  { id: "cleanup", title: "Cleaning up", statuses: ["POST_PROCESSING"] },
  { id: "ready", title: "Ready / shipped", statuses: ["READY_FOR_PICKUP"] },
  { id: "done", title: "Done this week", statuses: ["PICKED_UP"] },
] as const;
