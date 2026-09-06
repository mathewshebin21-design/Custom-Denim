import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { db } from "@/lib/db";
import { getAdminCommissionDetail, nextStageOptions } from "@/lib/admin/service";
import { suggestArtists } from "@/lib/ai/artistMatchmaker";
import { formatDate, formatPrice } from "@/lib/format";
import {
  AssignArtistPanel,
  AdvanceStagePanel,
  ProductionUpdatePanel,
  PaymentPanel,
  ShipmentPanel,
  PublishPassportPanel,
} from "@/components/admin/AdminCommissionActions";

export const metadata: Metadata = { title: "Commission — Admin" };

export default async function AdminCommissionDetailPage(props: PageProps<"/admin/commissions/[id]">) {
  const { id } = await props.params;

  let commission;
  try {
    commission = await getAdminCommissionDetail(id);
  } catch {
    notFound();
  }

  const concept = commission.concepts[0];
  const approvedVersion = concept?.versions.find((v) => v.status === "approved") ??
    concept?.versions.find((v) => v.id === concept.currentVersionId);
  const selectedDirection = concept?.creativeDirections.find((d) => d.isSelected);

  const designSpec = approvedVersion ? JSON.parse(approvedVersion.designSpecJson) : null;
  const feasibility = approvedVersion?.feasibilityNotes ? JSON.parse(approvedVersion.feasibilityNotes) : null;
  const palette: string[] = selectedDirection ? JSON.parse(selectedDirection.colorPalette || "[]") : [];

  const themes: string[] = JSON.parse(commission.themesJson || "[]");
  const reachedStages = commission.productionStages.map((s) => s.stage);
  const stageOptions = nextStageOptions(reachedStages);

  const [allArtists, suggested] = await Promise.all([
    db.artist.findMany({ orderBy: { name: "asc" } }),
    suggestArtists(themes.length ? themes : selectedDirection ? JSON.parse(selectedDirection.themesJson) : []),
  ]);

  return (
    <div className="container-editorial py-16">
      <p className="label-eyebrow text-rust mb-4">Admin · Commission</p>
      <h1 className="font-display text-4xl mb-2">{commission.customer.name}</h1>
      <p className="text-ink/50 text-sm mb-12">
        {commission.garment.label} · {formatDate(commission.createdAt)} · Status:{" "}
        {commission.status.replace(/_/g, " ")}
      </p>

      <div className="grid gap-16 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-12">
          {/* Production brief */}
          <section>
            <p className="label-eyebrow text-ink/50 mb-4">Production Brief</p>
            <div className="border border-line p-6 space-y-6 text-sm">
              <div>
                <p className="label-eyebrow text-ink/40 mb-2">Customer Story</p>
                <p className="text-ink/80 whitespace-pre-wrap">{commission.storyText}</p>
              </div>
              {commission.aestheticText && (
                <div>
                  <p className="label-eyebrow text-ink/40 mb-2">Aesthetic</p>
                  <p className="text-ink/80">{commission.aestheticText}</p>
                </div>
              )}
              {selectedDirection && (
                <div>
                  <p className="label-eyebrow text-ink/40 mb-2">Creative Direction</p>
                  <p className="font-semibold">{selectedDirection.title}</p>
                  <p className="text-ink/70">{selectedDirection.narrative}</p>
                </div>
              )}
              {designSpec && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="label-eyebrow text-ink/40 mb-2">Required Elements</p>
                      <p className="text-ink/70">{designSpec.requiredElements.join(", ") || "—"}</p>
                    </div>
                    <div>
                      <p className="label-eyebrow text-ink/40 mb-2">Elements to Avoid</p>
                      <p className="text-ink/70">{designSpec.elementsToAvoid.join(", ") || "—"}</p>
                    </div>
                    <div>
                      <p className="label-eyebrow text-ink/40 mb-2">Placement</p>
                      <p className="text-ink/70">{designSpec.placementDetail}</p>
                    </div>
                    <div>
                      <p className="label-eyebrow text-ink/40 mb-2">Materials</p>
                      <p className="text-ink/70">{designSpec.materialNotes}</p>
                    </div>
                  </div>
                </>
              )}
              <div>
                <p className="label-eyebrow text-ink/40 mb-2">Color Palette</p>
                <div className="flex flex-wrap gap-2">
                  {palette.map((c) => (
                    <span key={c} className="border border-line px-2 py-1 text-xs">{c}</span>
                  ))}
                </div>
              </div>
              {feasibility && (
                <div className="bg-paper-dim/40 p-4">
                  <p className="label-eyebrow text-denim mb-2">AI Feasibility Notes (Advisory)</p>
                  <p className="text-ink/70 mb-2">{feasibility.summary}</p>
                  {feasibility.considerations?.length > 0 && (
                    <ul className="list-disc list-inside text-ink/60">
                      {feasibility.considerations.map((c: string) => <li key={c}>{c}</li>)}
                    </ul>
                  )}
                </div>
              )}
              {commission.referenceImages.length > 0 && (
                <div>
                  <p className="label-eyebrow text-ink/40 mb-2">Reference Images</p>
                  <div className="flex flex-wrap gap-3">
                    {commission.referenceImages.map((ref) => (
                      <div key={ref.id} className="relative h-20 w-20 border border-line">
                        <Image src={ref.url} alt="Reference" fill unoptimized className="object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {approvedVersion?.imageUrl && (
                <div>
                  <p className="label-eyebrow text-ink/40 mb-2">AI Concept Visualization</p>
                  <div className="relative aspect-[4/5] max-w-xs border border-line">
                    <Image src={approvedVersion.imageUrl} alt="Concept" fill unoptimized className="object-cover" />
                  </div>
                </div>
              )}
              <div>
                <p className="label-eyebrow text-ink/40 mb-2">Price Tier</p>
                <p className="text-ink/70">
                  {commission.order ? formatPrice(commission.order.priceCents) : "No order yet"}
                </p>
              </div>
            </div>
          </section>

          {/* Revision history */}
          {concept && concept.versions.length > 0 && (
            <section>
              <p className="label-eyebrow text-ink/50 mb-4">Customer Revisions</p>
              <ol className="space-y-3">
                {concept.versions.map((v) => (
                  <li key={v.id} className="border border-line p-4 text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold">Version {v.versionNumber}</span>
                      <span className="text-xs uppercase text-ink/40">{v.status}</span>
                    </div>
                    {v.customerFeedback && (
                      <p className="text-ink/60 italic">&ldquo;{v.customerFeedback}&rdquo;</p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <AssignArtistPanel
            commissionId={commission.id}
            artists={(suggested.length ? suggested : allArtists).map((a) => ({
              id: a.id,
              name: a.name,
              capacityStatus: a.capacityStatus,
            }))}
            assignedArtistId={commission.artistAssignment?.artistId}
          />
          <AdvanceStagePanel
            key={stageOptions.join(",")}
            commissionId={commission.id}
            stageOptions={stageOptions}
          />
          <ProductionUpdatePanel commissionId={commission.id} />
          {commission.order && (
            <PaymentPanel commissionId={commission.id} status={commission.order.payment?.status ?? "pending"} />
          )}
          {commission.order && (
            <ShipmentPanel
              commissionId={commission.id}
              carrier={commission.order.shipment?.carrier ?? undefined}
              trackingNumber={commission.order.shipment?.trackingNumber ?? undefined}
            />
          )}
          <PublishPassportPanel
            commissionId={commission.id}
            canPublish={reachedStages.includes("delivered") && !commission.artwork?.passport}
          />
        </aside>
      </div>
    </div>
  );
}
