import "server-only";
import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/auth/guards";

const STAGE_ORDER = [
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

export function nextStageOptions(reachedStages: string[]): string[] {
  const lastIndex = STAGE_ORDER.reduce((acc, s, i) => (reachedStages.includes(s) ? i : acc), -1);
  return STAGE_ORDER.slice(lastIndex + 1);
}

export async function advanceStage(commissionId: string, stage: string, notes?: string) {
  if (!STAGE_ORDER.includes(stage)) throw new ApiError(400, "Unknown production stage");

  const reached = (
    await db.productionStage.findMany({ where: { commissionId }, select: { stage: true } })
  ).map((s) => s.stage);
  if (!nextStageOptions(reached).includes(stage)) {
    throw new ApiError(409, "This stage has already been reached or is out of sequence");
  }

  const openStage = await db.productionStage.findFirst({
    where: { commissionId, exitedAt: null },
    orderBy: { enteredAt: "desc" },
  });
  if (openStage) {
    await db.productionStage.update({ where: { id: openStage.id }, data: { exitedAt: new Date() } });
  }

  const created = await db.productionStage.create({ data: { commissionId, stage, notes } });

  const commissionStatus = stage === "delivered" ? "completed" : "in_production";
  await db.commission.update({ where: { id: commissionId }, data: { status: commissionStatus } });

  return created;
}

export async function addProductionUpdate(
  commissionId: string,
  stage: string,
  message: string,
  photoUrl?: string,
) {
  return db.productionUpdate.create({
    data: { commissionId, stage, message, photoUrl },
  });
}

export async function setPaymentStatus(commissionId: string, status: string) {
  const order = await db.order.findUnique({ where: { commissionId }, include: { payment: true } });
  if (!order || !order.payment) throw new ApiError(404, "No order/payment found for this commission");
  return db.payment.update({
    where: { id: order.payment.id },
    data: { status, paidAt: status === "succeeded" ? new Date() : order.payment.paidAt },
  });
}

export async function setShipment(
  commissionId: string,
  data: { carrier?: string; trackingNumber?: string; markShipped?: boolean; markDelivered?: boolean },
) {
  const order = await db.order.findUnique({ where: { commissionId } });
  if (!order) throw new ApiError(404, "No order found for this commission");

  return db.shipment.upsert({
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
    include: { artwork: { include: { approvedVersion: { include: { creativeDirection: true } } } } },
  });
  if (!commission || !commission.artwork) {
    throw new ApiError(400, "This commission has no approved artwork yet");
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

  await db.commission.update({ where: { id: commissionId }, data: { status: "completed" } });

  return passport;
}
