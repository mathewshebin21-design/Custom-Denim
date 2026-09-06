import type { PaymentService } from "./types";
import { StripePaymentService, loadStripeConfigFromEnv } from "./stripeProvider";

export type { PaymentService, CreateCheckoutParams, CheckoutResult, PaymentWebhookEvent, CheckoutSessionSnapshot } from "./types";

let instance: PaymentService | null = null;

/**
 * The one place that knows payment providers exist — mirrors
 * src/lib/storage/index.ts's getStorage() exactly. Everything else depends
 * only on the PaymentService interface; no caller branches on
 * PAYMENT_PROVIDER itself.
 *
 * Requires PAYMENT_PROVIDER explicitly (no silent default), and never
 * derives it — or any provider credential — from APP_ENV, so a
 * misconfigured deployment can't accidentally use the wrong provider or
 * credentials just because APP_ENV happened to be set a certain way.
 */
export function getPaymentService(): PaymentService {
  if (instance) return instance;

  const provider = process.env.PAYMENT_PROVIDER;
  if (!provider) {
    throw new Error('PAYMENT_PROVIDER is not set. Set it to "stripe" — see .env.example.');
  }
  if (provider === "stripe") {
    instance = new StripePaymentService(loadStripeConfigFromEnv());
  } else {
    throw new Error(`Unknown PAYMENT_PROVIDER "${provider}" — must be "stripe".`);
  }
  return instance;
}
