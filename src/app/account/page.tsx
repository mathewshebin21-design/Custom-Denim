import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/format";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "My Commissions" };

const STATUS_LABELS: Record<string, string> = {
  intake: "Just Started",
  in_studio: "Choosing a Direction",
  concept_selected: "In the Studio",
  revising: "Refining Concept",
  approved: "Approved",
  in_production: "In Production",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function AccountPage() {
  const session = await requireSession();
  const commissions = await db.commission.findMany({
    where: { customerId: session.id },
    orderBy: { createdAt: "desc" },
    include: { garment: true, order: true },
  });

  return (
    <div className="container-editorial py-24">
      <p className="label-eyebrow text-rust mb-4">My Account</p>
      <div className="flex items-end justify-between mb-12">
        <h1 className="font-display text-4xl">Your commissions.</h1>
        <ButtonLink href="/create">Start a New Piece</ButtonLink>
      </div>

      {commissions.length === 0 ? (
        <div className="border border-dashed border-line py-20 text-center">
          <p className="font-display text-xl mb-2">No commissions yet.</p>
          <p className="text-sm text-ink/60 mb-8">Start your first piece in the Custom Creation Studio.</p>
          <ButtonLink href="/create">Create Your Piece</ButtonLink>
        </div>
      ) : (
        <div className="divide-y divide-line border-t border-b border-line">
          {commissions.map((c) => {
            const isInStudio = c.status === "in_studio" || c.status === "revising" || c.status === "intake";
            return (
              <Link
                key={c.id}
                href={isInStudio ? `/create/${c.id}` : `/account/commissions/${c.id}`}
                className="flex items-center justify-between py-6 hover:bg-paper-dim/40 px-2 -mx-2"
              >
                <div>
                  <p className="font-display text-lg">{c.garment.label}</p>
                  <p className="text-xs text-ink/50">{formatDate(c.createdAt)}</p>
                </div>
                <div className="flex items-center gap-8">
                  {c.order && <p className="text-sm text-ink/60">{formatPrice(c.order.priceCents)}</p>}
                  <span className="label-eyebrow text-xs border border-line px-3 py-1.5">
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
