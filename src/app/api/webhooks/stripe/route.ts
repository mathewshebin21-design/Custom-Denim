import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPaymentService } from "@/lib/payments";
import { emitPaymentEvent } from "@/lib/payments/types";
import { markPaymentSucceeded } from "@/lib/admin/service";

/**
 * Stripe webhook receiver — the ONLY place a payment is ever marked
 * "succeeded" as a result of something Stripe told us (see
 * markPaymentSucceeded's own doc comment for the admin-manual exception).
 *
 * No session/auth check here by design: authenticity comes entirely from
 * the Stripe-Signature header verified against STRIPE_WEBHOOK_SECRET, not
 * from anything a logged-in user could produce. The raw request body is
 * read via request.text() and handed to Stripe's own signature
 * verification unmodified — re-serializing a parsed body would change its
 * bytes and break the signature.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const paymentService = getPaymentService();

  emitPaymentEvent({ name: "payment.webhook.received" });

  let event;
  try {
    event = paymentService.verifyWebhook(rawBody, signature);
  } catch (err) {
    emitPaymentEvent({ name: "payment.webhook.verification_failed" });
    console.error("[payments] webhook signature verification failed", {
      error: err instanceof Error ? err.message : err,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const isNewEvent = await db
      .$transaction(async (tx) => {
        await tx.webhookEvent.create({
          data: { provider: "stripe", eventId: event.providerEventId, type: event.type },
        });
        return true;
      })
      .catch((err) => {
        // P2002 on (provider, eventId) means this exact event was already
        // recorded — the persistent, database-backed idempotency guarantee
        // (not an in-memory flag) required for safe redelivery/replay.
        if (err && typeof err === "object" && "code" in err && err.code === "P2002") return false;
        throw err;
      });

    if (!isNewEvent) {
      emitPaymentEvent({ name: "payment.webhook.duplicate", detail: { providerEventId: event.providerEventId } });
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (event.type === "checkout_completed" && event.providerSessionId) {
      await handleCheckoutCompleted(event);
    } else if (event.type === "checkout_expired" && event.providerSessionId) {
      await handleCheckoutExpired(event.providerSessionId);
    } else {
      emitPaymentEvent({ name: "payment.webhook.unhandled_event" });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[payments] webhook processing failed", { error: err instanceof Error ? err.message : err });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function handleCheckoutCompleted(event: {
  providerSessionId: string | null;
  amountTotalCents: number | null;
  currency: string | null;
  providerPaymentIntentId: string | null;
}) {
  const providerSessionId = event.providerSessionId!;
  const payment = await db.payment.findUnique({
    where: { providerSessionId },
    include: { order: { include: { commission: true } } },
  });
  if (!payment) {
    // A session we have no record of — nothing to reconcile against. Not
    // retried (200), just logged for investigation.
    console.error("[payments] webhook referenced an unknown checkout session", { providerSessionId });
    return;
  }
  if (payment.status === "succeeded") {
    // Already applied (e.g. a second event type for the same successful
    // checkout). No-op.
    return;
  }

  const order = payment.order;

  // The webhook event body itself is already authoritative: it came from
  // Stripe's servers and its signature was just verified (verifyWebhook,
  // above) against a secret only this server and Stripe know. Reconciling
  // against it is not optional.
  //
  // Independently re-fetching the session from Stripe's API is an
  // additional cross-check, not a replacement for that — and, being a
  // second network call, it can fail for reasons that have nothing to do
  // with whether the payment is legitimate (a transient outage, a
  // firewalled environment). Treated as best-effort: attempted, logged if
  // it disagrees with the webhook body, but never allowed to block a
  // confirmation the signed webhook body already supports on its own.
  const paymentService = getPaymentService();
  let snapshot: Awaited<ReturnType<typeof paymentService.retrieveCheckoutSession>> | null = null;
  try {
    snapshot = await paymentService.retrieveCheckoutSession(providerSessionId);
  } catch (err) {
    console.error("[payments] best-effort session re-fetch failed — proceeding on webhook body alone", {
      providerSessionId,
      error: err instanceof Error ? err.message : err,
    });
  }
  if (snapshot && (snapshot.amountTotalCents !== event.amountTotalCents || snapshot.currency !== event.currency)) {
    console.error("[payments] session re-fetch disagreed with webhook body — investigate", {
      providerSessionId,
      webhookAmountCents: event.amountTotalCents,
      snapshotAmountCents: snapshot.amountTotalCents,
    });
  }

  const amountMatches = event.amountTotalCents === order.priceCents;
  const currencyMatches = event.currency?.toLowerCase() === order.currency.toLowerCase();

  if (!amountMatches || !currencyMatches) {
    emitPaymentEvent({
      name: "payment.webhook.reconciliation_failed",
      detail: {
        commissionId: order.commissionId,
        expectedAmountCents: order.priceCents,
        expectedCurrency: order.currency,
        webhookAmountCents: event.amountTotalCents ?? -1,
        webhookCurrency: event.currency ?? "unknown",
      },
    });
    console.error("[payments] amount/currency reconciliation failed — payment NOT marked succeeded", {
      commissionId: order.commissionId,
      providerSessionId,
    });
    return;
  }

  await markPaymentSucceeded(order.commissionId, payment.id, {
    provider: "stripe",
    providerPaymentIntentId: event.providerPaymentIntentId ?? snapshot?.providerPaymentIntentId ?? null,
  });
  emitPaymentEvent({ name: "payment.state.succeeded", detail: { commissionId: order.commissionId } });
}

async function handleCheckoutExpired(providerSessionId: string) {
  const payment = await db.payment.findUnique({ where: { providerSessionId } });
  // Only reset if still awaiting completion — never downgrade an
  // already-succeeded payment if an expired event arrives out of order.
  if (payment && payment.status === "checkout_created") {
    await db.payment.update({ where: { id: payment.id }, data: { status: "pending" } });
  }
}
