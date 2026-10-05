/** Minimal types for the parts of Square's Web Payments SDK we use. */
declare namespace SquareWeb {
  type TokenResult = {
    status: "OK" | "Cancel" | "Error" | string;
    token?: string;
    errors?: { message: string; field?: string; type?: string }[];
    details?: { card?: { brand?: string; last4?: string } };
  };
  type VerificationDetails = {
    amount: string;
    currencyCode: string;
    intent: "CHARGE";
    billingContact: { givenName?: string; familyName?: string; email?: string; phone?: string; countryCode?: string };
    customerInitiated: boolean;
    sellerKeyedIn: boolean;
  };
  interface PaymentMethod {
    attach(selector: string | HTMLElement, options?: Record<string, unknown>): Promise<void>;
    tokenize(details?: VerificationDetails): Promise<TokenResult>;
    destroy(): Promise<boolean>;
  }
  interface PaymentRequest {
    update(options: { total: { amount: string; label: string } }): boolean;
  }
  interface Payments {
    card(options?: { style?: Record<string, Record<string, string>> }): Promise<PaymentMethod>;
    paymentRequest(options: { countryCode: string; currencyCode: string; total: { amount: string; label: string } }): PaymentRequest;
    googlePay(req: PaymentRequest): Promise<PaymentMethod>;
    applePay(req: PaymentRequest): Promise<PaymentMethod>;
  }
}

interface Window {
  Square?: { payments(applicationId: string, locationId: string): Promise<SquareWeb.Payments> };
}
