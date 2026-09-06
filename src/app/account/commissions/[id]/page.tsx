import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ApiError } from "@/lib/auth/guards";
import { requireSession } from "@/lib/auth/guards";
import { getCommissionDetail } from "@/lib/studio/service";
import { resolveAssetUrl } from "@/lib/storage";
import { ProductionTimeline } from "@/components/account/ProductionTimeline";
import { ReviewForm } from "@/components/account/ReviewForm";
import { CheckoutButton } from "@/components/account/CheckoutButton";
import { formatDate, formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Commission Detail" };

export default async function CommissionDetailPage(props: PageProps<"/account/commissions/[id]">) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  // Purely informational — which message to show while we wait for the
  // real, server-verified state below. Never used to decide whether
  // anything is actually paid; `commission.order.status` (re-read fresh
  // from the database on every render) is the only source of truth for
  // that, exactly as it was before this redirect existed.
  const checkoutParam = typeof searchParams?.checkout === "string" ? searchParams.checkout : null;
  const session = await requireSession();

  let commission;
  try {
    commission = await getCommissionDetail(id, session.id, session.role);
  } catch (err) {
    if (err instanceof ApiError) notFound();
    throw err;
  }

  const concept = commission.concepts[0];
  const currentVersion = concept?.versions.find((v) => v.id === concept.currentVersionId);
  const reachedStages = commission.productionStages.map((s) => s.stage);

  // Resolved server-side at render time (never persisted) — these are
  // private, short-lived signed URLs, not the stable value stored on each
  // ProductionUpdate row.
  const updatePhotoUrls = await Promise.all(
    commission.productionUpdates.map((u) => resolveAssetUrl(u.photoUrl)),
  );

  return (
    <div className="container-editorial py-24">
      <p className="label-eyebrow text-rust mb-4">Commission</p>
      <h1 className="font-display text-4xl mb-2">{commission.garment.label}</h1>
      <p className="text-ink/50 text-sm mb-16">Created {formatDate(commission.createdAt)}</p>

      {checkoutParam === "success" && commission.order && commission.order.status !== "paid" && (
        <div className="mb-8 border border-denim bg-denim/5 p-4 text-sm text-denim">
          Payment is being confirmed — this can take a few moments. This
          page will update automatically once it&apos;s verified; no need to
          pay again.
        </div>
      )}
      {checkoutParam === "cancelled" && (
        <div className="mb-8 border border-line bg-paper-dim/40 p-4 text-sm text-ink/70">
          Checkout was cancelled. You can start payment again whenever
          you&apos;re ready.
        </div>
      )}

      <div className="grid gap-16 lg:grid-cols-[1fr_22rem] mb-16">
        <div>
          {currentVersion?.imageUrl && (
            <div className="relative aspect-[4/5] max-w-md bg-paper-dim mb-8 overflow-hidden">
              <Image src={currentVersion.imageUrl} alt={commission.garment.label} fill unoptimized className="object-cover" />
            </div>
          )}

          <p className="label-eyebrow text-ink/50 mb-6">Production Progress</p>
          {commission.order && commission.order.status !== "paid" && (
            <p className="text-xs text-ink/50 mb-4">
              Production begins once payment is confirmed — see Order in the sidebar.
            </p>
          )}
          <ProductionTimeline reachedStages={reachedStages} />

          {commission.productionUpdates.length > 0 && (
            <div className="mt-12">
              <p className="label-eyebrow text-ink/50 mb-6">Updates</p>
              <div className="space-y-6">
                {commission.productionUpdates.map((u, i) => (
                  <div key={u.id} className="flex gap-6">
                    <p className="w-28 shrink-0 text-xs text-ink/40 uppercase pt-1">{formatDate(u.createdAt)}</p>
                    <div className="flex-1">
                      <p className="text-sm font-semibold mb-1">{u.stage.replace(/_/g, " ")}</p>
                      <p className="text-sm text-ink/70 mb-2">{u.message}</p>
                      {updatePhotoUrls[i] && (
                        <div className="relative h-40 w-40 border border-line">
                          <Image src={updatePhotoUrls[i]} alt="Production update" fill unoptimized className="object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {commission.status === "completed" && !commission.review && (
            <div className="mt-16 border-t border-line pt-8">
              <p className="label-eyebrow text-ink/50 mb-4">Leave a Review</p>
              <ReviewForm commissionId={commission.id} />
            </div>
          )}
        </div>

        <aside className="space-y-8">
          <div>
            <p className="label-eyebrow text-ink/50 mb-3">Status</p>
            <p className="text-sm">{commission.status.replace(/_/g, " ")}</p>
          </div>

          {commission.artistAssignment && (
            <div>
              <p className="label-eyebrow text-ink/50 mb-3">Artist</p>
              <p className="text-sm">{commission.artistAssignment.artist.name}</p>
            </div>
          )}

          {commission.order && (
            <div>
              <p className="label-eyebrow text-ink/50 mb-3">Order</p>
              <p className="text-sm">{formatPrice(commission.order.priceCents)}</p>
              {commission.order.payment && (
                <p className="text-xs text-ink/50 mt-1">Payment: {commission.order.payment.status.replace(/_/g, " ")}</p>
              )}
              {commission.order.status !== "paid" && (
                <div className="mt-4">
                  <CheckoutButton commissionId={commission.id} />
                </div>
              )}
              {commission.order.shipment?.trackingNumber && (
                <p className="text-xs text-ink/50 mt-1">
                  Tracking: {commission.order.shipment.carrier} {commission.order.shipment.trackingNumber}
                </p>
              )}
            </div>
          )}

          {commission.artwork?.passport && (
            <div>
              <p className="label-eyebrow text-ink/50 mb-3">Art Passport</p>
              <Link
                href={`/passport/${commission.artwork.passport.publicSlug}`}
                className="text-sm underline hover:text-rust"
              >
                View Passport →
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
