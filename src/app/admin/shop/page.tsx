import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { listProductsForAdmin, listRetailOrdersForAdmin } from "@/lib/retail/service";
import { formatDate, formatPrice } from "@/lib/format";
import { AdminProductManager } from "@/components/admin/AdminProductManager";

export const metadata: Metadata = { title: "Shop — Admin" };

const STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting Payment",
  paid: "Paid",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

export default async function AdminShopPage() {
  await requireAdmin();
  const [products, orders] = await Promise.all([listProductsForAdmin(), listRetailOrdersForAdmin()]);

  return (
    <div className="container-editorial py-16">
      <p className="label-eyebrow text-rust mb-4">Admin</p>
      <h1 className="font-display text-4xl mb-12">Shop</h1>

      <AdminProductManager initialProducts={products} />

      <h2 className="font-display text-2xl mt-16 mb-6">Retail Orders</h2>
      <div className="divide-y divide-line border-t border-b border-line">
        {orders.map((order) => (
          <div key={order.id} className="flex items-center justify-between py-4">
            <div>
              <p className="font-semibold">{order.customer.name}</p>
              <p className="text-xs text-ink/50">
                {order.items.length} item{order.items.length === 1 ? "" : "s"} · {formatDate(order.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <p className="text-sm text-ink/60">{formatPrice(order.subtotalCents, order.currency)}</p>
              <span className="label-eyebrow text-xs border border-line px-3 py-1.5">
                {STATUS_LABELS[order.status] ?? order.status}
              </span>
            </div>
          </div>
        ))}
        {orders.length === 0 && <p className="py-12 text-center text-ink/50">No retail orders yet.</p>}
      </div>
    </div>
  );
}
