import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { getInventoryOverview, LOW_STOCK_THRESHOLD } from "@/lib/retail/service";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Inventory — Admin" };

const CATEGORY_LABELS: Record<string, string> = {
  shirts: "Shirts",
  t_shirts: "T-Shirts",
  denim: "Denim",
  cargos: "Cargos & Chinos",
  shoes: "Shoes",
  activewear: "Activewear",
  jackets: "Jackets",
};

function formatByCurrency(rows: [string, number][]): string {
  if (rows.length === 0) return formatPrice(0, "inr");
  return rows.map(([currency, cents]) => formatPrice(cents, currency)).join(" + ");
}

export default async function AdminInventoryPage() {
  await requireAdmin();

  const overview = await getInventoryOverview();
  const needsAttention = [...overview.outOfStock, ...overview.lowStock];

  const stats = [
    { label: "SKUs", value: String(overview.totalSkus) },
    { label: "Units In Stock", value: String(overview.totalUnitsInStock) },
    { label: "Stock Value (Retail)", value: formatByCurrency(overview.stockValueByCurrency) },
    { label: "Out of Stock", value: String(overview.outOfStock.length) },
    { label: `Low Stock (≤${LOW_STOCK_THRESHOLD})`, value: String(overview.lowStock.length) },
    { label: "Units Sold", value: String(overview.unitsSold) },
    { label: "Retail Revenue", value: formatByCurrency(overview.revenueByCurrency) },
    { label: "Retail AOV", value: formatByCurrency(overview.aovByCurrency) },
  ];

  return (
    <div className="container-editorial py-16">
      <p className="label-eyebrow text-rust mb-4">Admin</p>
      <h1 className="font-display text-4xl mb-12">Inventory &amp; Stock</h1>

      <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4 mb-16">
        {stats.map((s) => (
          <div key={s.label} className="bg-paper p-6">
            <p className="label-eyebrow text-ink/50 mb-3">{s.label}</p>
            <p className="font-display text-2xl">{s.value}</p>
          </div>
        ))}
      </div>

      {needsAttention.length > 0 && (
        <div className="mb-16">
          <h2 className="font-display text-2xl mb-6">Needs Attention</h2>
          <div className="divide-y divide-line border-t border-b border-line">
            {needsAttention.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-xs text-ink/50">{CATEGORY_LABELS[p.category] ?? p.category}</p>
                </div>
                <span
                  className={`label-eyebrow text-xs border px-3 py-1.5 ${
                    p.quantity === 0 ? "border-rust text-rust" : "border-line text-ink/70"
                  }`}
                >
                  {p.quantity === 0 ? "Sold out" : `Only ${p.quantity} left`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="font-display text-2xl mb-6">By Category</h2>
      <div className="divide-y divide-line border-t border-b border-line mb-16">
        {overview.byCategory.map((data) => (
          <div key={data.category} className="flex items-center justify-between py-3">
            <p className="font-semibold">{CATEGORY_LABELS[data.category] ?? data.category}</p>
            <div className="flex items-center gap-8 text-sm text-ink/60">
              <span>{data.count} SKUs</span>
              <span>{data.units} units</span>
              <span className="min-w-28 text-right">{formatByCurrency(data.valueByCurrency)}</span>
            </div>
          </div>
        ))}
        {overview.byCategory.length === 0 && <p className="py-12 text-center text-ink/50">No products yet.</p>}
      </div>

      <h2 className="font-display text-2xl mb-6">All Products</h2>
      <div className="divide-y divide-line border-t border-b border-line">
        {overview.products.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-3 gap-4">
            <div className="min-w-0">
              <p className="font-semibold truncate">{p.title}</p>
              <p className="text-xs text-ink/50">
                {p.brand ?? "—"} · {CATEGORY_LABELS[p.category] ?? p.category}
                {!p.active && " · Inactive"}
              </p>
            </div>
            <div className="flex items-center gap-6 text-sm flex-shrink-0">
              <span className="text-ink/60">{formatPrice(p.priceCents, p.currency)}</span>
              <span
                className={
                  p.quantity === 0
                    ? "text-rust"
                    : p.quantity <= LOW_STOCK_THRESHOLD
                      ? "text-rust/80"
                      : "text-ink/60"
                }
              >
                {p.quantity} in stock
              </span>
              <span className="w-24 text-right text-ink/60">
                {formatPrice(p.priceCents * p.quantity, p.currency)}
              </span>
            </div>
          </div>
        ))}
        {overview.products.length === 0 && <p className="py-12 text-center text-ink/50">No products yet.</p>}
      </div>
    </div>
  );
}
