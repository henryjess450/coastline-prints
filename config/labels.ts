/**
 * Shipping labels printed on Avery 8168 sheets (3½ × 5 in, 4 per Letter
 * sheet, 2 across and 2 down). All sizes in inches.
 *
 * The return address is NOT here on purpose (public repo): it comes from
 * SHIP_FROM_ADDRESS in .env, see config/private.server.ts.
 */
export const labels = {
  sheet: {
    name: "Avery 8168",
    pageIn: [8.5, 11] as const,
    labelIn: [3.5, 5] as const,
    /** Left edge of the first column and top edge of the first row. */
    marginIn: [0.5, 0.5] as const,
    /** Distance from one label's left (or top) edge to the next one's. */
    pitchIn: [4, 5] as const,
    columns: 2,
    rows: 2,
  },
  /**
   * Shifts every label on the page, for printers that feed a little off.
   * Positive x moves right, positive y moves down. Print the alignment test
   * on plain paper, hold it over a label sheet, and adjust in steps of 1/32 in.
   */
  nudgeIn: { x: 0, y: 0 },
  /**
   * Keeps the artwork this far inside each label's edge, so a small feed
   * error never cuts off text.
   */
  safeIn: 0,
  /** The designs offered on the Print label screen, in order. The first is the default. */
  designs: [
    { id: "harbour", name: "Harbour", note: "Navy band, big ship-to, QR" },
    { id: "manifest", name: "Manifest", note: "Boxed form, black and white" },
    { id: "sea", name: "Sea Bands", note: "Waves along the bottom" },
    { id: "spine", name: "Spine", note: "Navy edge with the lettering" },
    { id: "bigtype", name: "Big Type", note: "Largest address" },
  ],
} as const;

export type LabelDesignId = (typeof labels.designs)[number]["id"];
