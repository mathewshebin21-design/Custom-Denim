"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/** Posts to /api/cart/items and routes to /cart on success. A 401 means the
 * visitor isn't signed in — /cart itself is proxy-guarded (see
 * src/proxy.ts), so sending them to /login?next=/cart&product=... here
 * (rather than silently failing) is the honest outcome of "add to cart"
 * for a signed-out visitor, given guest carts aren't supported yet (see
 * Cart's schema comment in prisma/schema.prisma). */
export function AddToCartForm({ productId, maxQuantity }: { productId: string; maxQuantity: number }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addToCart() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantity }),
    });
    if (res.status === 401) {
      router.push(`/login?next=${encodeURIComponent("/cart")}`);
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not add to cart");
      setLoading(false);
      return;
    }
    router.push("/cart");
  }

  if (maxQuantity < 1) {
    return <p className="label-eyebrow text-ink/40">Sold out</p>;
  }

  return (
    <div className="flex flex-col gap-3 max-w-xs">
      <div className="flex items-center gap-3">
        <label className="label-eyebrow text-ink/50 text-xs" htmlFor="quantity">
          Qty
        </label>
        <select
          id="quantity"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="border border-line px-3 py-2 text-sm bg-paper"
        >
          {Array.from({ length: Math.min(maxQuantity, 10) }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <Button disabled={loading} onClick={addToCart}>
        {loading ? "Adding…" : "Add to Cart"}
      </Button>
      {error && <p className="text-xs text-rust">{error}</p>}
    </div>
  );
}
