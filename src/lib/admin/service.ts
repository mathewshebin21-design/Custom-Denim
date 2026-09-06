import "server-only";
import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/auth/guards";

/** Accepts either the top-level client or a transaction client, so
 * `advanceStage` can be called standalone (existing admin routes) or
 * composed atomically inside a larger transaction (the payment webhook —
 * see markPaymentSucceeded below). */
type Db = typeof db | Prisma.TransactionClient;

// The canonical, ordered set of production stages. SQLite has no native
// enum/CHECK-on-existing-table support without a full table rebuild (see
// schema.prisma), so ProductionStage.stage and ProductionUpdate.stage stay
// plain strings — this list is the single source of truth enforced at the
// application boundary instead. Exported so the UI (the "advance stage" and
// "post an update" panels) can only ever offer these values, not free text.
export const STAGE_ORDER: string[] = [
  "artist_review",
  "base_preparation",
  "sketch",
  "painting",
  "detail_work",
  "quality_control",
  "packed",
  "shipped",
  "delivered",
];

export const STAGE_LABELS: Record<string, string> = {
  artist_review: "Artist Review",
  base_preparation: "Base Preparation",
  sketch: "Sketch",
  painting: "Painting",
  detail_work: "Detail Work",
  quality_control: "Quality Control",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
};

/**
 * Completion lifecycle — one authoritative rule:
 *
 * `Commission.status` becomes `"completed"` if and only if the production
 * stage reaches `"delivered"` (via advanceStage() below). That is the single
 * source of truth for "is this commission done."
 *
 * `Shipment.deliveredAt` (set via setShipment({ markDelivered: true })) used
 * to be an independent signal that never touched Commission.status at all —
 * an admin could mark a shipment delivered while the commission still showed
 * an earlier status. It no longer is: marking a shipment delivered now drives
 * the same advanceStage("delivered") transition, so there is exactly one
 * event that means "done," not two unreconciled ones.
 *
 * Art Passport publication is a separate, later, optional certification step
 * — it requires status to already be "completed" (i.e. delivered) and does
 * not itself define completion.
 */

export async function listCommissionsForAdmin() {
  return db.commission.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: true,
      garment: true,
      order: { include: { payment: true } },
      artistAssignment: { include: { artist: true } },
      productionStages: { orderBy: { enteredAt: "desc" }, take: 1 },
    },
  });
}

export async function getAdminCommissionDetail(commissionId: string) {
  const commission = await db.commission.findUnique({
    where: { id: commissionId },
    include: {
      customer: true,
      garment: true,
      referenceImages: true,
      concepts: {
        include: {
          creativeDirections: true,
          versions: { orderBy: { versionNumber: "asc" }, include: { creativeDirection: true } },
        },
      },
      artistAssignment: { include: { artist: true } },
      productionStages: { orderBy: { enteredAt: "asc" } },
      productionUpdates: { orderBy: { createdAt: "asc" } },
      artwork: { include: { passport: true } },
      order: { include: { payment: true, shipment: true } },
      review: true,
    },
  });
  if (!commission) throw new ApiError(404, "Commission not found");
  return commission;
}

export async function assignArtist(commissionId: string, artistId: string) {
  const artist = await db.artist.findUnique({ where: { id: artistId } });
  if (!artist) throw new ApiError(404, "Artist not found");

  return db.artistAssignment.upsert({
    where: { commissionId },
    create: { commissionId, artistId, status: "assigned" },
    update: { artistId, status: "assigned" },
  });
}

/**
 * The single stage that may legally come next, as a 0- or 1-element array
 * (empty once "delivered" has been reached). Returning the whole remaining
 * tail of STAGE_ORDER here would let advanceStage() accept ANY future stage
 * as "valid," i.e. let a caller skip straight from "artist_review" to
 * "delivered" in one request — which defeats both the ordering guarantee
 * this function exists to provide and the "can't mark delivered before
 * shipped" rule in setShipment() below, which relies on this rejecting
 * anything that isn't the immediate next stage.
 */
export function nextStageOptions(reachedStages: string[]): string[] {
  const lastIndex = STAGE_ORDER.reduce((acc, s, i) => (reachedStages.includes(s) ? i : acc), -1);
  const next = STAGE_ORDER[lastIndex + 1];
  return next ? [next] : [];
}

/**
 * The payment -> production gate. This is the ONLY place a ProductionStage
 * row is ever created — including the very first one ("artist_review") —
 * so it is the single, unavoidable enforcement point regardless of caller:
 * the ordinary admin "advance stage" route, the delivery cascade in
 * setShipment() below, and markPaymentSucceeded()'s own call to kick off
 * production all funnel through here. A commission whose Order has not
 * reached "paid" can never acquire a ProductionStage no matter which of
 * those paths is used, including a forged direct API call.
 */
export async function advanceStage(commissionId: string, stage: string, notes?: string, client: Db = db) {
  if (!STAGE_ORDER.includes(stage)) throw new ApiError(400, "Unknown production stage");

  const order = await client.order.findUnique({ where: { commissionId }, select: { status: true } });
  if (!order || order.status !== "paid") {
    throw new ApiError(402, "Payment must be verified before production can begin.");
  }

  const reached = (
    await client.productionStage.findMany({ where: { commissionId }, select: { stage: true } })
  ).map((s) => s.stage);
  if (!nextStageOptions(reached).includes(stage)) {
    throw new ApiError(409, "This stage has already been reached or is out of sequence");
  }

  const openStage = await client.productionStage.findFirst({
    where: { commissionId, exitedAt: null },
    orderBy: { enteredAt: "desc" },
  });
  if (openStage) {
    await client.productionStage.update({ where: { id: openStage.id }, data: { exitedAt: new Date() } });
  }

  const created = await client.productionStage.create({ data: { commissionId, stage, notes } });

  const commissionStatus = stage === "delivered" ? "completed" : "in_production";
  await client.commission.update({ where: { id: commissionId }, data: { status: commissionStatus } });

  return created;
}

export async function addProductionUpdate(
  commissionId: string,
  stage: string,
  message: string,
  photoUrl?: string,
) {
  if (!STAGE_ORDER.includes(stage)) throw new ApiError(400, "Unknown production stage");
  return db.productionUpdate.create({
    data: { commissionId, stage, message, photoUrl },
  });
}

/**
 * The single path that transitions an order to "paid" — called by the
 * Stripe webhook handler (src/app/api/webhooks/stripe/route.ts) after
 * signature verification and amount/currency reconciliation, and by
 * setPaymentStatus() below for the sanctioned admin manual-reconciliation
 * case. Both callers share this function specifically so "what happens
 * when payment succeeds" (mark paid, kick off production) is defined once,
 * not duplicated.
 *
 * Runs as one transaction: Payment and Order flip to their paid state and
 * the first ProductionStage is created atomically, so nothing can observe
 * an order marked "paid" with production still ungated (or vice versa).
 */
export async function markPaymentSucceeded(
  commissionId: string,
  paymentId: string,
  data: { provider: string; providerPaymentIntentId?: string | null },
) {
  return db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "succeeded",
        provider: data.provider,
        providerPaymentIntentId: data.providerPaymentIntentId ?? undefined,
        paidAt: new Date(),
      },
    });
    await tx.order.update({ where: { commissionId }, data: { status: "paid" } });
    // Idempotent: if production has already started (e.g. a duplicate
    // webhook processed under a race, or an admin already reconciled this
    // manually), the first stage already exists and nextStageOptions()
    // inside advanceStage() will correctly reject re-creating it — caught
    // and ignored here rather than surfaced as an error, since "payment
    // succeeded and production already started" is not a failure.
    try {
      await advanceStage(commissionId, "artist_review", undefined, tx);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 409)) throw err;
    }
  });
}

/**
 * Admin manual payment reconciliation — the sanctioned exception to "only
 * the webhook marks payment succeeded" (see markPaymentSucceeded above).
 * This exists for cases the webhook cannot cover on its own (a payment
 * taken through an out-of-band channel, a webhook delivery that was lost
 * and never retried successfully) and is deliberately kept admin-only,
 * separate from the customer checkout flow, and fully auditable through
 * this codebase (it is not a generic "mark anything paid" bypass — it
 * still goes through markPaymentSucceeded's same transactional state
 * transition, so it can never desync Payment/Order/production start).
 */
export async function setPaymentStatus(commissionId: string, status: string) {
  const order = await db.order.findUnique({ where: { commissionId }, include: { payment: true } });
  if (!order || !order.payment) throw new ApiError(404, "No order/payment found for this commission");

  if (status === "succeeded") {
    await markPaymentSucceeded(commissionId, order.payment.id, { provider: "manual" });
    return db.payment.findUniqueOrThrow({ where: { id: order.payment.id } });
  }

  return db.payment.update({
    where: { id: order.payment.id },
    data: { status, paidAt: order.payment.paidAt },
  });
}

export async function setShipment(
  commissionId: string,
  data: { carrier?: string; trackingNumber?: string; markShipped?: boolean; markDelivered?: boolean },
) {
  const order = await db.order.findUnique({ where: { commissionId } });
  if (!order) throw new ApiError(404, "No order found for this commission");

  const shipment = await db.shipment.upsert({
    where: { orderId: order.id },
    create: {
      orderId: order.id,
      carrier: data.carrier,
      trackingNumber: data.trackingNumber,
      shippedAt: data.markShipped ? new Date() : undefined,
      deliveredAt: data.markDelivered ? new Date() : undefined,
    },
    update: {
      carrier: data.carrier,
      trackingNumber: data.trackingNumber,
      ...(data.markShipped ? { shippedAt: new Date() } : {}),
      ...(data.markDelivered ? { deliveredAt: new Date() } : {}),
    },
  });

  // Single source of truth for completion (see the lifecycle comment above):
  // marking a shipment delivered drives the same "delivered" production
  // stage transition, rather than being a second, unreconciled signal. If
  // the stage has already been reached some other way (e.g. via the stage
  // panel directly), this is a no-op. If production genuinely hasn't reached
  // "shipped" yet, advanceStage throws — surfaced to the admin as a real
  // error rather than silently marking something "delivered" out of order.
  if (data.markDelivered) {
    const reached = (
      await db.productionStage.findMany({ where: { commissionId }, select: { stage: true } })
    ).map((s) => s.stage);
    if (!reached.includes("delivered")) {
      try {
        await advanceStage(commissionId, "delivered");
      } catch (err) {
        if (err instanceof ApiError) {
          throw new ApiError(
            409,
            "Cannot mark this shipment delivered until production has reached the \"Shipped\" stage.",
          );
        }
        throw err;
      }
    }
  }

  return shipment;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function publishArtPassport(
  commissionId: string,
  data: { materials?: string; finalDescription?: string; careInstructions?: string },
) {
  const commission = await db.commission.findUnique({
    where: { id: commissionId },
    include: {
      artwork: {
        include: { approvedVersion: { include: { creativeDirection: true } }, passport: true },
      },
    },
  });
  if (!commission || !commission.artwork) {
    throw new ApiError(400, "This commission has no approved artwork yet");
  }
  // Completion (status === "completed") is defined solely by reaching the
  // "delivered" production stage (see the lifecycle comment above). The
  // passport is a certification of an already-completed piece, not the
  // event that completes it — publishing one for a piece that hasn't
  // actually been delivered would misrepresent its provenance.
  if (commission.status !== "completed") {
    throw new ApiError(
      400,
      "This commission must reach \"Delivered\" before its Art Passport can be published.",
    );
  }
  if (commission.artwork.passport) {
    throw new ApiError(409, "This commission already has a published Art Passport.");
  }

  const year = new Date().getFullYear();
  const passportCount = await db.artPassport.count();
  const pieceId = `CD-${year}-${String(passportCount + 1).padStart(4, "0")}`;
  const publicSlug = `${slugify(commission.artwork.approvedVersion.creativeDirection.title)}-${randomUUID().slice(0, 6)}`;

  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const qrCodeDataUrl = await QRCode.toDataURL(`${baseUrl}/passport/${publicSlug}`);

  await db.artwork.update({
    where: { id: commission.artwork.id },
    data: {
      materials: data.materials,
      finalDescription: data.finalDescription,
      completedAt: new Date(),
    },
  });

  const passport = await db.artPassport.create({
    data: {
      artworkId: commission.artwork.id,
      pieceId,
      publicSlug,
      qrCodeDataUrl,
      careInstructions: data.careInstructions,
      authenticityStatement:
        "This piece is one-of-one: AI-designed with a human artist, hand-made once, and will never be reproduced.",
      publishedAt: new Date(),
    },
  });

  // Not setting Commission.status here: the precondition above already
  // guarantees it's "completed" (set when production reached "delivered").
  // Publishing a passport certifies an already-completed piece; it doesn't
  // define completion itself. See the lifecycle comment above.

  return passport;
}
