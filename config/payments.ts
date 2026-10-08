/**
 * Interac e-Transfer payments. Customers send the exact amount with a code in
 * the message; the site reads the deposit email from your inbox and confirms
 * the order. Turned on by the ETRANSFER_* settings in .env (see SETUP.md).
 */
export const etransfer = {
  /** Off: card only, even with the .env settings filled in. */
  enabled: true,
  /** Off what's being sent by e-Transfer (no card fees), after coupons and gift cards. */
  discountPercent: 2,
  /** Unpaid e-Transfer orders are cancelled after this, and held codes released. */
  payWindowMinutes: 120,
  /**
   * A deposit with no code still pays an order when exactly one waiting
   * order has that exact amount. Off: those go to admin for review.
   */
  autoMatchByAmount: true,
  /** Interac's sending domains. Only emails signed (DKIM) by these can confirm an order on their own. */
  interacDomains: ["interac.ca"],
};

export type EtransferConfig = typeof etransfer;
