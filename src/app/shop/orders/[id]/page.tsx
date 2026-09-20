import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/guards";
import { ApiError } from "@/lib/auth/guards";
import { getRetailOrderForCustomer } from "@/lib/retail/service";
import { formatDate, formatPrice } from "@/lib/format";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Order Confirmation" };

const STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting Payment",
  paid: "Paid",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

export default async function RetailOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const { checkout } = await searchParams;

  let order;
  try {
    order = await getRetailOrderForCustomer(id, session.id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div className="container-editorial py-24 max-w-2xl">
      <p className="label-eyebrow text-rust mb-4">Ease Wear / Shop</p>
      <h1 className="font-display text-4xl mb-2">
        {checkout === "success" ? "Thank you." : "Order Details"}
      </h1>
      <p className="text-ink/60 mb-10">
        {checkout === "success"
          ? "Your payment is being confirmed — this page updates automatically once it's verified."
          : `Placed ${formatDate(order.createdAt)}`}
      </p>

      <div className="border border-line p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <p className="label-eyebrow">Status</p>
          <span className="label-eyebrow text-xs border border-line px-3 py-1.5">
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>
        <div className="divide-y divide-line">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-3">
              <div>
                <p>{item.titleSnapshot}</p>
                <p className="text-xs text-ink/50">Qty {item.quantity}</p>
              </div>
              <p className="text-sm">{formatPrice(item.priceCentsSnapshot * item.quantity, order.currency)}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-line">
          <p className="label-eyebrow">Total</p>
          <p className="text-xl">{formatPrice(order.subtotalCents, order.currency)}</p>
        </div>
      </div>

      <p className="text-sm text-ink/60 mb-8 whitespace-pre-line">{order.shippingAddress}</p>

      <ButtonLink href="/shop" variant="secondary">
        Continue Shopping
      </ButtonLink>
      <Link href="/account" className="label-eyebrow ml-6 hover:text-rust">
        My Account
      </Link>
    </div>
  );
}
