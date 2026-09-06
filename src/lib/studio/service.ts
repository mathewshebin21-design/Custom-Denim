import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/auth/guards";
import { generateCreativeDirections } from "@/lib/ai/creativeDirector";
import { interpretDesign } from "@/lib/ai/designInterpreter";
import { assessFeasibility } from "@/lib/ai/feasibilityAssistant";
import { generateConceptImage } from "@/lib/ai/visualConceptGenerator";
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

  const version = await db.conceptVersion.create({
    data: {
      conceptId: concept.id,
      creativeDirectionId: direction.id,
      versionNumber: 1,
      designSpecJson: JSON.stringify(spec),
      imageUrl,
      feasibilityNotes: JSON.stringify(feasibility),
      status: "proposed",
    },
    include: { creativeDirection: true },
  });

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
  const nextVersionNumber = currentVersion.versionNumber + 1;
  const imageUrl = generateConceptImage({
    title: direction.title,
    colorPalette: directionOutput.colorPalette,
    versionSeed: `${direction.id}-v${nextVersionNumber}`,
  });

  const version = await db.conceptVersion.create({
    data: {
      conceptId: concept.id,
      creativeDirectionId: direction.id,
      versionNumber: nextVersionNumber,
      designSpecJson: JSON.stringify(spec),
      imageUrl,
      feasibilityNotes: JSON.stringify(feasibility),
      customerFeedback: feedback,
      status: "revised",
    },
    include: { creativeDirection: true },
  });

  await db.concept.update({ where: { id: concept.id }, data: { currentVersionId: version.id } });

  return version;
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

  const priceCents = commission.budgetTierCents ?? commission.garment.basePriceCents;

  const artwork = await db.$transaction(async (tx) => {
    await tx.commission.update({ where: { id: commissionId }, data: { status: "approved" } });
    const created = await tx.artwork.create({
      data: { commissionId, approvedVersionId: version.id },
    });
    await tx.productionStage.create({ data: { commissionId, stage: "artist_review" } });
    const order = await tx.order.create({ data: { commissionId, priceCents } });
    await tx.payment.create({
      data: { orderId: order.id, amountCents: priceCents, status: "pending" },
    });
    return created;
  });

  return artwork;
}
