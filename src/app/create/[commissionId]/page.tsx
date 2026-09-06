import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession, ApiError } from "@/lib/auth/guards";
import { getCommissionDetail, computeCommissionPriceCents } from "@/lib/studio/service";
import { StudioWorkspace, type WorkspaceDirection, type WorkspaceVersion } from "@/components/studio/StudioWorkspace";

export const metadata: Metadata = { title: "Your Concept" };

export default async function CommissionWorkspacePage(props: PageProps<"/create/[commissionId]">) {
  const { commissionId } = await props.params;
  const session = await requireSession();

  let commission;
  try {
    commission = await getCommissionDetail(commissionId, session.id, session.role);
  } catch (err) {
    if (err instanceof ApiError) notFound();
    throw err;
  }

  const concept = commission.concepts[0];
  const directions: WorkspaceDirection[] = (concept?.creativeDirections ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    narrative: d.narrative,
    colorPalette: JSON.parse(d.colorPalette || "[]"),
    themes: JSON.parse(d.themesJson || "[]"),
    placement: d.placement ?? "",
    isSelected: d.isSelected,
  }));

  const directionById = new Map(directions.map((d) => [d.id, d]));

  const versions: WorkspaceVersion[] = (concept?.versions ?? []).map((v) => ({
    id: v.id,
    versionNumber: v.versionNumber,
    status: v.status,
    imageUrl: v.imageUrl,
    customerFeedback: v.customerFeedback,
    createdAt: v.createdAt.toISOString(),
    designSpec: JSON.parse(v.designSpecJson),
    feasibility: v.feasibilityNotes ? JSON.parse(v.feasibilityNotes) : null,
    directionTitle: directionById.get(v.creativeDirectionId)?.title ?? "",
  }));

  return (
    <div className="container-editorial py-24">
      <StudioWorkspace
        commissionId={commission.id}
        commissionStatus={commission.status}
        directions={directions}
        versions={versions}
        hasArtwork={Boolean(commission.artwork)}
        priceCents={computeCommissionPriceCents(commission)}
      />
    </div>
  );
}
