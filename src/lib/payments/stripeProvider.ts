import Stripe from "stripe";
import type {
  CheckoutResult,
  CheckoutSessionSnapshot,
  CreateCheckoutParams,
  PaymentService,
  PaymentWebhookEvent,
} from "./types";
import { emitPaymentEvent } from "./types";

/**
 * Stripe Checkout Sessions (hosted, redirect-based) — chosen over Stripe.js
 * Elements because this is a one-time, one-item purchase per commission,
 * not an embedded cart: the server creates a Session and hands the browser
 * a URL to redirect to, so no publishable key or client-side Stripe.js is
 * needed at all (that's only required for an embedded/Elements integration,
 * which this app has no use for — kept out to avoid redundant config).
 */

export type StripeConfig = {
  secretKey: string;
  webhookSecret: string;
};

export function loadStripeConfigFromEnv(): StripeConfig {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is required when PAYMENT_PROVIDER=stripe");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is required when PAYMENT_PROVIDER=stripe");
  return { secretKey, webhookSecret };
}

export class StripePaymentService implements PaymentService {
  private client: Stripe;

  constructor(private config: StripeConfig) {
    this.client = new Stripe(config.secretKey);
  }

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    try {
      const session = await this.client.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: params.customerEmail,
        // orderId in metadata is how the webhook maps an event back to a
        // Payment/Order row without trusting anything else in the payload.
        metadata: { orderId: params.orderId },
        line_items: [
          {
            price_data: {
              currency: params.currency,
              unit_amount: params.amountCents,
              product_data: { name: params.description },
            },
            quantity: 1,
          },
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
      });
      if (!session.url) throw new Error("Stripe did not return a checkout URL");
      emitPaymentEvent({ name: "payment.checkout.created", detail: { orderId: params.orderId, providerSessionId: session.id } });
      return { checkoutUrl: session.url, providerSessionId: session.id };
    } catch (err) {
      emitPaymentEvent({ name: "payment.checkout.create_failed", detail: { orderId: params.orderId } });
      console.error("[payments] Stripe checkout creation failed", {
        orderId: params.orderId,
        error: err instanceof Error ? err.message : err,
      });
      throw new Error("Could not start checkout");
    }
  }

  verifyWebhook(rawBody: string, signatureHeader: string | null): PaymentWebhookEvent {
    if (!signatureHeader) {
      throw new Error("Missing Stripe-Signature header");
    }
    // constructEvent is Stripe's own signature verification — it throws on
    // any mismatch (wrong secret, tampered body, expired timestamp). This
    // is the only place a webhook request is trusted; nothing here reads
    // the body as JSON before this succeeds.
    const event = this.client.webhooks.constructEvent(rawBody, signatureHeader, this.config.webhookSecret);

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      return {
        providerEventId: event.id,
        type: "checkout_completed",
        providerSessionId: session.id,
        amountTotalCents: session.amount_total,
        currency: session.currency,
        providerPaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
      };
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      return {
        providerEventId: event.id,
        type: "checkout_expired",
        providerSessionId: session.id,
        amountTotalCents: null,
        currency: null,
        providerPaymentIntentId: null,
      };
    }

    // Any other event type is acknowledged (200) but not acted on — Stripe's
    // own recommendation is to only ever reject on bad signatures, never on
    // an event type you don't happen to handle.
    return {
      providerEventId: event.id,
      type: "ignored",
      providerSessionId: null,
      amountTotalCents: null,
      currency: null,
      providerPaymentIntentId: null,
    };
  }

  async retrieveCheckoutSession(providerSessionId: string): Promise<CheckoutSessionSnapshot> {
    const session = await this.client.checkout.sessions.retrieve(providerSessionId);
    return {
      paymentStatus: session.payment_status,
      amountTotalCents: session.amount_total,
      currency: session.currency,
      providerPaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
    };
  }
}
