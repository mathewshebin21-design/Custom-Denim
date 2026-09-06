import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/auth/guards";
import { generateCreativeDirections } from "@/lib/ai/creativeDirector";
import { interpretDesign } from "@/lib/ai/designInterpreter";
import { assessFeasibility } from "@/lib/ai/feasibilityAssistant";
import { generateConceptImage } from "@/lib/ai/visualConceptGenerator";
import { getPaymentService } from "@/lib/payments";
import type { CreativeDirectionOutput, DesignSpec, StudioIntake } from "@/types/studio";

export type CommissionIntakeInput = {
  garmentId: string;
  storyText: string;
  aestheticText?: string;
  themes: string[];
  colors: string[];
  placement?: string;
  occasion?: string;
  budgetTierCents?: number;
  referenceImageUrls: string[];
};

async function loadCommissionOrThrow(commissionId: string, customerId: string, role: string) {
  const commission = await db.commission.findUnique({
    where: { id: commissionId },
    include: { garment: true, concepts: { include: { creativeDirections: true, versions: true } } },
  });
  if (!commission) throw new ApiError(404, "Commission not found");
  if (commission.customerId !== customerId && role !== "admin") {
    throw new ApiError(403, "Not your commission");
  }
  return commission;
}

export async function createCommission(customerId: string, input: CommissionIntakeInput) {
  const garment = await db.garment.findUnique({ where: { id: input.garmentId } });
  if (!garment) throw new ApiError(400, "Unknown garment");

  const intake: StudioIntake = {
    garmentType: garment.type,
    garmentLabel: garment.label,
    storyText: input.storyText,
    aestheticText: input.aestheticText,
    themes: input.themes,
    colors: input.colors,
    placement: input.placement,
    occasion: input.occasion,
    budgetTierCents: input.budgetTierCents,
  };

  const directorOutput = await generateCreativeDirections(intake);

  const commission = await db.commission.create({
    data: {
      customerId,
      garmentId: garment.id,
      status: "in_studio",
      storyText: input.storyText,
      aestheticText: input.aestheticText,
      themesJson: JSON.stringify(input.themes),
      colorsJson: JSON.stringify(input.colors),
      placement: input.placement,
      occasion: input.occasion,
      budgetTierCents: input.budgetTierCents,
      referenceImages: {
        create: input.referenceImageUrls.map((url) => ({ url })),
      },
      concepts: {
        create: {
          creativeDirections: {
            create: directorOutput.directions.map((d, i) => ({
              title: d.title,
              narrative: d.narrative,
              colorPalette: JSON.stringify(d.colorPalette),
              themesJson: JSON.stringify(d.themes),
              placement: d.placement,
              order: i,
            })),
          },
        },
      },
    },
    include: {
      garment: true,
      concepts: { include: { creativeDirections: true } },
    },
  });

  return commission;
}

export async function getCommissionDetail(commissionId: string, customerId: string, role: string) {
  const commission = await db.commission.findUnique({
    where: { id: commissionId },
    include: {
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
  if (commission.customerId !== customerId && role !== "admin") {
    throw new ApiError(403, "Not your commission");
  }
  return commission;
}

async function buildIntakeFromCommission(commission: {
  garment: { type: string; label: string };
  storyText: string;
  aestheticText: string | null;
  themesJson: string;
  colorsJson: string;
  placement: string | null;
  occasion: string | null;
  budgetTierCents: number | null;
}): Promise<StudioIntake> {
  return {
    garmentType: commission.garment.type,
    garmentLabel: commission.garment.label,
    storyText: commission.storyText,
    aestheticText: commission.aestheticText ?? undefined,
    themes: JSON.parse(commission.themesJson || "[]"),
    colors: JSON.parse(commission.colorsJson || "[]"),
    placement: commission.placement ?? undefined,
    occasion: commission.occasion ?? undefined,
    budgetTierCents: commission.budgetTierCents ?? undefined,
  };
}

function directionToOutput(direction: { title: string; narrative: string; colorPalette: string; themesJson: string; placement: string | null }): CreativeDirectionOutput {
  return {
    title: direction.title,
    narrative: direction.narrative,
    colorPalette: JSON.parse(direction.colorPalette || "[]"),
    themes: JSON.parse(direction.themesJson || "[]"),
    placement: direction.placement ?? "",
  };
}

/**
 * (conceptId, versionNumber) is unique at the database level (see
 * schema.prisma). Two versions racing to claim the same number surface here
 * as a clean conflict instead of an opaque 500 or — worse — a silent
 * constraint failure the caller doesn't understand.
 */
function isVersionConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function nextVersionNumberFor(conceptId: string): Promise<number> {
  const max = await db.conceptVersion.aggregate({
    where: { conceptId },
    _max: { versionNumber: true },
  });
  return (max._max.versionNumber ?? 0) + 1;
}

export async function selectDirection(
  commissionId: string,
  customerId: string,
  role: string,
  creativeDirectionId: string,
) {
  const commission = await loadCommissionOrThrow(commissionId, customerId, role);
  const concept = commission.concepts[0];
  if (!concept) throw new ApiError(400, "No concept exists for this commission");
  const direction = concept.creativeDirections.find((d) => d.id === creativeDirectionId);
  if (!direction) throw new ApiError(404, "Creative direction not found");

  const intake = await buildIntakeFromCommission(commission);
  const directionOutput = directionToOutput(direction);

  const spec = await interpretDesign(intake, directionOutput);
  const feasibility = await assessFeasibility(commission.garment.label, spec);
  const imageUrl = generateConceptImage({
    title: direction.title,
    colorPalette: directionOutput.colorPalette,
    versionSeed: `${direction.id}-v1`,
  });

  await db.creativeDirection.updateMany({
    where: { conceptId: concept.id },
    data: { isSelected: false },
  });
  await db.creativeDirection.update({ where: { id: direction.id }, data: { isSelected: true } });

  // versionNumber is computed from the current max rather than hardcoded, so
  // selecting a direction more than once for the same concept (there's no UI
  // path to this today, but nothing at the API layer prevented it either)
  // can never collide with an existing version. The @@unique constraint on
  // (conceptId, versionNumber) is the hard backstop if two requests race.
  let version;
  try {
    const versionNumber = await nextVersionNumberFor(concept.id);
    version = await db.conceptVersion.create({
      data: {
        conceptId: concept.id,
        creativeDirectionId: direction.id,
        versionNumber,
        designSpecJson: JSON.stringify(spec),
        imageUrl,
        feasibilityNotes: JSON.stringify(feasibility),
        status: "proposed",
      },
      include: { creativeDirection: true },
    });
  } catch (err) {
    if (isVersionConflict(err)) {
      throw new ApiError(409, "A version conflict occurred — please refresh and try again.");
    }
    throw err;
  }

  await db.concept.update({ where: { id: concept.id }, data: { currentVersionId: version.id } });
  await db.commission.update({ where: { id: commissionId }, data: { status: "revising" } });

  return version;
}

export async function reviseConcept(
  commissionId: string,
  customerId: string,
  role: string,
  feedback: string,
) {
  const commission = await loadCommissionOrThrow(commissionId, customerId, role);
  const concept = commission.concepts[0];
  if (!concept || !concept.currentVersionId) {
    throw new ApiError(400, "No active concept version to revise");
  }
  const currentVersion = concept.versions.find((v) => v.id === concept.currentVersionId);
  if (!currentVersion) throw new ApiError(400, "Current version not found");
  const direction = concept.creativeDirections.find((d) => d.id === currentVersion.creativeDirectionId);
  if (!direction) throw new ApiError(400, "Creative direction not found");

  const intake = await buildIntakeFromCommission(commission);
  const directionOutput = directionToOutput(direction);
  const priorSpec: DesignSpec = JSON.parse(currentVersion.designSpecJson);

  const spec = await interpretDesign(intake, directionOutput, priorSpec, feedback);
  const feasibility = await assessFeasibility(commission.garment.label, spec);
  const imageUrl = generateConceptImage({
    title: direction.title,
    colorPalette: directionOutput.colorPalette,
    versionSeed: `${direction.id}-v${currentVersion.versionNumber + 1}`,
  });

  // Recompute from the current max (not currentVersion.versionNumber + 1)
  // immediately before the write, so two concurrent revision requests can't
  // both compute the same "next" number from a now-stale currentVersion.
  let version;
  try {
    const versionNumber = await nextVersionNumberFor(concept.id);
    version = await db.conceptVersion.create({
      data: {
        conceptId: concept.id,
        creativeDirectionId: direction.id,
        versionNumber,
        designSpecJson: JSON.stringify(spec),
        imageUrl,
        feasibilityNotes: JSON.stringify(feasibility),
        customerFeedback: feedback,
        status: "revised",
      },
      include: { creativeDirection: true },
    });
  } catch (err) {
    if (isVersionConflict(err)) {
      throw new ApiError(409, "A version conflict occurred — please refresh and try again.");
    }
    throw err;
  }

  await db.concept.update({ where: { id: concept.id }, data: { currentVersionId: version.id } });

  return version;
}

/**
 * The price a commission will be ordered at. Exported so the Studio can show
 * the customer this exact number in the approval-confirmation step before
 * approveVersion() below uses the same formula to create the real Order.
 */
export function computeCommissionPriceCents(commission: {
  budgetTierCents: number | null;
  garment: { basePriceCents: number };
}): number {
  return commission.budgetTierCents ?? commission.garment.basePriceCents;
}

export async function approveVersion(
  commissionId: string,
  customerId: string,
  role: string,
  versionId: string,
) {
  const commission = await loadCommissionOrThrow(commissionId, customerId, role);
  const concept = commission.concepts[0];
  const version = concept?.versions.find((v) => v.id === versionId);
  if (!concept || !version) throw new ApiError(404, "Concept version not found");

  await db.conceptVersion.update({ where: { id: version.id }, data: { status: "approved" } });

  // The price computed here is persisted once and never recomputed —
  // Order.priceCents is the server-side price lock a checkout session is
  // later created against (src/lib/payments/), and it does not change
  // after this point. Production itself does not start yet: creating the
  // first ProductionStage now happens only once payment is verified (see
  // advanceStage()'s payment gate and markPaymentSucceeded() in
  // src/lib/admin/service.ts) — approval creates a payable order, it does
  // not authorize production.
  const priceCents = computeCommissionPriceCents(commission);

  const artwork = await db.$transaction(async (tx) => {
    await tx.commission.update({ where: { id: commissionId }, data: { status: "approved" } });
    const created = await tx.artwork.create({
      data: { commissionId, approvedVersionId: version.id },
    });
    const order = await tx.order.create({ data: { commissionId, priceCents } });
    await tx.payment.create({
      data: { orderId: order.id, amountCents: priceCents, status: "pending" },
    });
    return created;
  });

  return artwork;
}

/**
 * Creates a provider checkout session for an approved commission's locked
 * order. Deliberately customer-only (no admin bypass, unlike
 * loadCommissionOrThrow's other callers) — an admin triggering someone
 * else's payment session is not a legitimate action this app supports.
 *
 * The amount/currency handed to the payment provider always comes from the
 * already-persisted Order row (see approveVersion's price lock above) —
 * nothing here accepts a price from the caller.
 */
export async function createCheckoutForCommission(
  commissionId: string,
  customerId: string,
  appBaseUrl: string,
) {
  const commission = await db.commission.findUnique({
    where: { id: commissionId },
    include: { customer: true, garment: true, order: { include: { payment: true } }, productionStages: true },
  });
  if (!commission) throw new ApiError(404, "Commission not found");
  if (commission.customerId !== customerId) throw new ApiError(403, "Not your commission");

  const order = commission.order;
  if (!order || !order.payment) {
    throw new ApiError(400, "This commission does not have a payable order yet.");
  }
  if (order.status === "paid" || order.payment.status === "succeeded") {
    throw new ApiError(409, "This order has already been paid.");
  }
  if (commission.productionStages.length > 0) {
    throw new ApiError(409, "This commission is already in production.");
  }

  const result = await getPaymentService().createCheckout({
    orderId: order.id,
    amountCents: order.priceCents,
    currency: order.currency,
    description: `Custom Denim — ${commission.garment.label}`,
    customerEmail: commission.customer.email,
    successUrl: `${appBaseUrl}/account/commissions/${commissionId}?checkout=success`,
    cancelUrl: `${appBaseUrl}/account/commissions/${commissionId}?checkout=cancelled`,
  });

  await db.payment.update({
    where: { id: order.payment.id },
    data: { status: "checkout_created", provider: "stripe", providerSessionId: result.providerSessionId },
  });

  return result;
}
