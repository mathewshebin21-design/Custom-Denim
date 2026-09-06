import type { Metadata } from "next";
import Link from "next/link";
import { listCommissionsForAdmin } from "@/lib/admin/service";
import { formatDate, formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "All Commissions" };

export default async function AdminCommissionsPage() {
  const commissions = await listCommissionsForAdmin();

  return (
    <div className="container-editorial py-16">
      <p className="label-eyebrow text-rust mb-4">Admin</p>
      <h1 className="font-display text-4xl mb-12">All Commissions</h1>

      <div className="divide-y divide-line border-t border-b border-line">
        {commissions.map((c) => (
          <Link
            key={c.id}
            href={`/admin/commissions/${c.id}`}
            className="flex items-center justify-between py-4 hover:bg-paper-dim/40 px-2 -mx-2"
          >
            <div>
              <p className="font-semibold">{c.customer.name}</p>
              <p className="text-xs text-ink/50">
                {c.garment.label} · {formatDate(c.createdAt)}
                {c.artistAssignment && ` · ${c.artistAssignment.artist.name}`}
              </p>
            </div>
            <div className="flex items-center gap-6">
              {c.order && <p className="text-sm text-ink/60">{formatPrice(c.order.priceCents)}</p>}
              <span className="label-eyebrow text-xs border border-line px-3 py-1.5">
                {c.status.replace(/_/g, " ")}
              </span>
            </div>
          </Link>
        ))}
        {commissions.length === 0 && <p className="py-12 text-center text-ink/50">No commissions yet.</p>}
      </div>
    </div>
  );
}
