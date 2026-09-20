import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Inventory — Admin" };

const LOW_STOCK_THRESHOLD = 2;

const CATEGORY_LABELS: Record<string, string> = {
  shirts: "Shirts",
  t_shirts: "T-Shirts",
  denim: "Denim",
  cargos: "Cargos & Chinos",
  shoes: "Shoes",
  activewear: "Activewear",
  jackets: "Jackets",
};

// Every money figure here is grouped by its own currency rather than summed
// into one number — products (and their orders) aren't all necessarily
// priced in the same currency now that admins can set it per product, and
// silently blending currencies into a single total would just be wrong.
function sumByCurrency(rows: { currency: string; amountCents: number }[]): [string, number][] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.amountCents);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

function formatByCurrency(rows: { currency: string; amountCents: number }[]): string {
  const totals = sumByCurrency(rows);
  if (totals.length === 0) return formatPrice(0, "inr");
  return totals.map(([currency, cents]) => formatPrice(cents, currency)).join(" + ");
}

export default async function AdminInventoryPage() {
  await requireAdmin();

  const [products, succeededPayments] = await Promise.all([
    db.product.findMany({ orderBy: [{ category: "asc" }, { quantity: "asc" }] }),
    db.retailPayment.findMany({
      where: { status: "succeeded" },
      include: { retailOrder: { include: { items: true } } },
    }),
  ]);

  const totalSkus = products.length;
  const totalUnitsInStock = products.reduce((sum, p) => sum + p.quantity, 0);
  const outOfStock = products.filter((p) => p.quantity === 0);
  const lowStock = products.filter((p) => p.quantity > 0 && p.quantity <= LOW_STOCK_THRESHOLD);
  const needsAttention = [...outOfStock, ...lowStock];

  const stockValueRows = products.map((p) => ({ currency: p.currency, amountCents: p.priceCents * p.quantity }));

  const retailOrdersCount = succeededPayments.length;
  const unitsSold = succeededPayments.reduce(
    (sum, p) => sum + p.retailOrder.items.reduce((s, i) => s + i.quantity, 0),
    0,
  );
  // Payments carry the amount actually charged; the order's own currency is
  // used since RetailPayment doesn't duplicate that field.
  const revenueRows = succeededPayments.map((p) => ({ currency: p.retailOrder.currency, amountCents: p.amountCents }));
  const revenueTotals = sumByCurrency(revenueRows);
  const aovByCurrency = revenueTotals.map(
    ([currency, cents]) => [currency, retailOrdersCount ? Math.round(cents / retailOrdersCount) : 0] as const,
  );

  const stats = [
    { label: "SKUs", value: String(totalSkus) },
    { label: "Units In Stock", value: String(totalUnitsInStock) },
    { label: "Stock Value (Retail)", value: formatByCurrency(stockValueRows) },
    { label: "Out of Stock", value: String(outOfStock.length) },
    { label: "Low Stock (≤2)", value: String(lowStock.length) },
    { label: "Units Sold", value: String(unitsSold) },
    { label: "Retail Revenue", value: formatByCurrency(revenueRows) },
    {
      label: "Retail AOV",
      value: aovByCurrency.length
        ? aovByCurrency.map(([currency, cents]) => formatPrice(cents, currency)).join(" + ")
        : formatPrice(0, "inr"),
    },
  ];

  const byCategory = Object.entries(
    products.reduce<Record<string, { count: number; units: number; valueRows: { currency: string; amountCents: number }[] }>>(
      (acc, p) => {
        const bucket = acc[p.category] ?? { count: 0, units: 0, valueRows: [] };
        bucket.count += 1;
        bucket.units += p.quantity;
        bucket.valueRows.push({ currency: p.currency, amountCents: p.priceCents * p.quantity });
        acc[p.category] = bucket;
        return acc;
      },
      {},
    ),
  ).sort((a, b) => b[1].units - a[1].units);

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
        {byCategory.map(([category, data]) => (
          <div key={category} className="flex items-center justify-between py-3">
            <p className="font-semibold">{CATEGORY_LABELS[category] ?? category}</p>
            <div className="flex items-center gap-8 text-sm text-ink/60">
              <span>{data.count} SKUs</span>
              <span>{data.units} units</span>
              <span className="min-w-28 text-right">{formatByCurrency(data.valueRows)}</span>
            </div>
          </div>
        ))}
        {byCategory.length === 0 && <p className="py-12 text-center text-ink/50">No products yet.</p>}
      </div>

      <h2 className="font-display text-2xl mb-6">All Products</h2>
      <div className="divide-y divide-line border-t border-b border-line">
        {products.map((p) => (
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
        {products.length === 0 && <p className="py-12 text-center text-ink/50">No products yet.</p>}
      </div>
    </div>
  );
}
