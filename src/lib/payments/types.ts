/**
 * Provider-agnostic payment contract, mirroring src/lib/storage/types.ts's
 * architecture: one small interface, one factory (index.ts) that picks the
 * implementation via `PAYMENT_PROVIDER`, and no provider-name branching
 * anywhere outside this directory.
 *
 * Deliberately narrow: only checkout creation and webhook verification are
 * needed by the current flow (a one-time commission payment, not a
 * subscription or a multi-item cart). `retrieveCheckout` exists specifically
 * so the webhook handler can independently re-fetch the session from the
 * provider's API rather than trusting only the webhook body — a real
 * defense-in-depth step, not a speculative addition.
 */

export type CreateCheckoutParams = {
  orderId: string;
  amountCents: number;
  currency: string;
  description: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutResult = {
  checkoutUrl: string;
  providerSessionId: string;
};

/** Normalized shape of "a checkout session finished or expired," independent
 * of whatever event-type vocabulary the underlying provider uses. */
export type PaymentWebhookEvent = {
  /** Provider's own unique event id — the persistent idempotency key (see
   * the WebhookEvent model). */
  providerEventId: string;
  type: "checkout_completed" | "checkout_expired" | "ignored";
  providerSessionId: string | null;
  amountTotalCents: number | null;
  currency: string | null;
  providerPaymentIntentId: string | null;
};

export type CheckoutSessionSnapshot = {
  paymentStatus: string;
  amountTotalCents: number | null;
  currency: string | null;
  providerPaymentIntentId: string | null;
};

export interface PaymentService {
  createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult>;
  /** Verifies the provider signature and parses the event. Throws on an
   * invalid/missing signature — callers must never treat a signature
   * failure as anything but a hard rejection. */
  verifyWebhook(rawBody: string, signatureHeader: string | null): PaymentWebhookEvent;
  /** Independent re-fetch of a checkout session's current state, used by
   * the webhook handler as a second source of truth for the reconciled
   * amount/currency rather than only trusting the webhook payload. */
  retrieveCheckoutSession(providerSessionId: string): Promise<CheckoutSessionSnapshot>;
}

export type PaymentEventName =
  | "payment.checkout.created"
  | "payment.checkout.create_failed"
  | "payment.webhook.received"
  | "payment.webhook.verification_failed"
  | "payment.webhook.duplicate"
  | "payment.webhook.reconciliation_failed"
  | "payment.webhook.unhandled_event"
  | "payment.state.succeeded"
  | "payment.production_gate.rejected";

export type PaymentEvent = {
  name: PaymentEventName;
  /** Safe identifiers only — never amounts derived from client input,
   * never raw webhook payloads, never provider secrets. */
  detail?: Record<string, string | number | boolean>;
};

export function emitPaymentEvent(event: PaymentEvent): void {
  console.log(`[payments] ${event.name}`, event.detail ?? {});
}
