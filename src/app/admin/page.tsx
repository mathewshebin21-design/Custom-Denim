import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { formatDate, formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Admin Overview" };

export default async function AdminOverviewPage() {
  // Redundant with AdminLayout's own check and src/proxy.ts — intentionally
  // so; see the comment on AdminLayout for why this page must not rely on
  // either of those alone.
  await requireAdmin();

  const [totalCommissions, approvedOrBeyond, succeededPayments, recentCommissions] = await Promise.all([
    db.commission.count(),
    db.commission.count({
      where: { status: { in: ["approved", "in_production", "completed"] } },
    }),
    db.payment.findMany({ where: { status: "succeeded" } }),
    db.commission.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { customer: true, garment: true, order: true },
    }),
  ]);

  const revenueCents = succeededPayments.reduce((sum, p) => sum + p.amountCents, 0);
  const aovCents = succeededPayments.length ? Math.round(revenueCents / succeededPayments.length) : 0;
  const approvalRate = totalCommissions ? Math.round((approvedOrBeyond / totalCommissions) * 100) : 0;

  const stats = [
    { label: "Commissions", value: String(totalCommissions) },
    { label: "Concept Approval Rate", value: `${approvalRate}%` },
    { label: "Revenue Collected", value: formatPrice(revenueCents) },
    { label: "Average Order Value", value: formatPrice(aovCents) },
  ];

  return (
    <div className="container-editorial py-16">
      <p className="label-eyebrow text-rust mb-4">Admin</p>
      <h1 className="font-display text-4xl mb-12">Studio Overview</h1>

      <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4 mb-16">
        {stats.map((s) => (
          <div key={s.label} className="bg-paper p-6">
            <p className="label-eyebrow text-ink/50 mb-3">{s.label}</p>
            <p className="font-display text-3xl">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl">Recent Commissions</h2>
        <Link href="/admin/commissions" className="label-eyebrow hover:text-rust">
          View all →
        </Link>
      </div>

      <div className="divide-y divide-line border-t border-b border-line">
        {recentCommissions.map((c) => (
          <Link
            key={c.id}
            href={`/admin/commissions/${c.id}`}
            className="flex items-center justify-between py-4 hover:bg-paper-dim/40 px-2 -mx-2"
          >
            <div>
              <p className="font-semibold">{c.customer.name}</p>
              <p className="text-xs text-ink/50">
                {c.garment.label} · {formatDate(c.createdAt)}
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
      </div>
    </div>
  );
}
