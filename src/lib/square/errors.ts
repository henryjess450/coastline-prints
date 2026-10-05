/**
 * Turns Square error codes into messages a customer can act on.
 * Never shows raw API errors to the browser.
 */
const messages: Record<string, string> = {
  CARD_DECLINED: "Your card was declined. Please try another card or contact your bank.",
  GENERIC_DECLINE: "Your card was declined. Please try another card or contact your bank.",
  CVV_FAILURE: "The security code (CVV) didn't match. Please check it and try again.",
  ADDRESS_VERIFICATION_FAILURE: "The postal code didn't match your card. Please check it and try again.",
  INVALID_EXPIRATION: "The expiry date isn't valid. Please check it and try again.",
  EXPIRATION_FAILURE: "This card has expired. Please use another card.",
  INSUFFICIENT_FUNDS: "The card doesn't have enough funds. Please try another card.",
  CARD_NOT_SUPPORTED: "This card type isn't supported. Please try another card.",
  INVALID_CARD: "The card details aren't valid. Please check them and try again.",
  INVALID_CARD_DATA: "The card details aren't valid. Please check them and try again.",
  VERIFY_CVV_FAILURE: "The security code (CVV) didn't match. Please check it and try again.",
  VERIFY_AVS_FAILURE: "The postal code didn't match your card. Please check it and try again.",
  CARD_DECLINED_VERIFICATION_REQUIRED: "Your bank needs extra verification. Please try again and complete the check.",
  CARD_DECLINED_CALL_ISSUER: "Your card was declined. Please call your bank or use another card.",
  TRANSACTION_LIMIT: "This payment is over your card's limit. Please try another card.",
  PAN_FAILURE: "The card number isn't valid. Please check it and try again.",
  INVALID_PIN: "The card was declined. Please try another card.",
  TEMPORARY_ERROR: "The payment service had a temporary problem. Please try again.",
};

export const GENERIC_PAYMENT_ERROR = "The payment didn't go through. Your card was not charged. Please try again.";

export function friendlyPaymentError(codes: string[]): string {
  for (const c of codes) if (messages[c]) return messages[c];
  return GENERIC_PAYMENT_ERROR;
}
