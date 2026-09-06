/**
 * Deterministic Stripe webhook test fixture. Signs a synthetic event body
 * using Stripe's own documented webhook-signing scheme
 * (`t=<timestamp>,v1=HMAC-SHA256(secret, "<timestamp>.<raw body>")`) against
 * STRIPE_WEBHOOK_SECRET, then POSTs it to a running app's
 * /api/webhooks/stripe.
 *
 * This exercises the real webhook route end-to-end — signature
 * verification, idempotency, reconciliation, and the payment->production
 * gate — without needing network access to Stripe's API, which this
 * signing step does not require (Stripe's own SDK verifies signatures
 * purely locally against the shared secret; it never calls out to Stripe
 * to do so). It does NOT exercise createCheckout()/retrieveCheckoutSession(),
 * which do require live API access — see the C3 report's "Sandbox/live
 * provider verification" section for what this does and doesn't prove.
 *
 * Usage:
 *   npx tsx scripts/dev-fixtures/simulate-stripe-webhook.ts \
 *     --url http://localhost:3000/api/webhooks/stripe \
 *     --secret whsec_... \
 *     --session-id cs_test_abc123 \
 *     --amount 45000 --currency usd \
 *     [--event-id evt_test_1] [--type checkout.session.completed] [--tamper] [--bad-signature]
 */
import "dotenv/config";
import { createHmac, randomUUID } from "node:crypto";

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function signPayload(payload: string, secret: string, timestamp: number): string {
  const signedPayload = `${timestamp}.${payload}`;
  const signature = createHmac("sha256", secret).update(signedPayload).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = (args.url as string) ?? "http://localhost:3000/api/webhooks/stripe";
  const secret = (args.secret as string) ?? process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("Pass --secret or set STRIPE_WEBHOOK_SECRET");
    process.exit(1);
  }
  const sessionId = (args["session-id"] as string) ?? `cs_test_${randomUUID().slice(0, 8)}`;
  const amountTotal = Number(args.amount ?? 45000);
  const currency = (args.currency as string) ?? "usd";
  const eventId = (args["event-id"] as string) ?? `evt_test_${randomUUID().slice(0, 12)}`;
  const type = (args.type as string) ?? "checkout.session.completed";

  const event = {
    id: eventId,
    object: "event",
    type,
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        amount_total: amountTotal,
        currency,
        payment_intent: `pi_test_${randomUUID().slice(0, 8)}`,
        payment_status: type === "checkout.session.completed" ? "paid" : "unpaid",
        metadata: {},
      },
    },
  };

  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  let signatureHeader = signPayload(payload, secret, timestamp);

  let body = payload;
  if (args.tamper) {
    // Signed correctly, then the body is changed afterward — must be
    // rejected, since the signature no longer matches these bytes.
    body = payload.replace(String(amountTotal), String(amountTotal + 1));
  }
  if (args["bad-signature"]) {
    signatureHeader = signPayload(payload, "wrong_secret_entirely", timestamp);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": signatureHeader },
    body,
  });
  const responseBody = await res.text();
  console.log(`HTTP ${res.status}`);
  console.log(responseBody);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
