"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/format";

type CartItem = {
  id: string;
  quantity: number;
  product: {
    id: string;
    title: string;
    priceCents: number;
    currency: string;
    quantity: number;
    images: { url: string }[];
  };
};

type Cart = { id: string; items: CartItem[] };

/** Client-managed cart view: quantity edits and removal call the /api/cart
 * routes and replace local state with the server's response, mirroring
 * CheckoutButton's "server response is the only source of truth, no
 * optimistic paid state" discipline for the checkout step itself. */
export function CartView({ initialCart }: { initialCart: Cart }) {
  const [cart, setCart] = useState(initialCart);
  const [shippingAddress, setShippingAddress] = useState("");
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotalCents = cart.items.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0);
  const currency = cart.items[0]?.product.currency ?? "inr";

  async function updateQuantity(itemId: string, quantity: number) {
    setBusyItemId(itemId);
    setError(null);
    const res = await fetch(`/api/cart/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Could not update cart");
    } else {
      setCart(body.cart);
    }
    setBusyItemId(null);
  }

  async function removeItem(itemId: string) {
    setBusyItemId(itemId);
    setError(null);
    const res = await fetch(`/api/cart/items/${itemId}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Could not remove item");
    } else {
      setCart(body.cart);
    }
    setBusyItemId(null);
  }

  async function checkout() {
    setCheckingOut(true);
    setError(null);
    const res = await fetch("/api/cart/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shippingAddress }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Could not start checkout");
      setCheckingOut(false);
      return;
    }
    window.location.href = body.checkoutUrl;
  }

  if (cart.items.length === 0) {
    return (
      <div className="border border-dashed border-line py-20 text-center">
        <p className="font-display text-xl mb-2">Your cart is empty.</p>
        <Link href="/shop" className="underline hover:text-rust text-sm">
          Browse the Shop
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-3">
      <div className="lg:col-span-2 divide-y divide-line border-t border-b border-line">
        {cart.items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 py-6">
            <div className="h-20 w-16 bg-paper-dim flex-shrink-0 relative overflow-hidden">
              {item.product.images[0] && (
                <Image src={item.product.images[0].url} alt={item.product.title} fill className="object-cover" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-display">{item.product.title}</p>
              <p className="text-sm text-ink/60">{formatPrice(item.product.priceCents, item.product.currency)}</p>
            </div>
            <select
              disabled={busyItemId === item.id}
              value={item.quantity}
              onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
              className="border border-line px-2 py-1.5 text-sm bg-paper"
            >
              {Array.from({ length: Math.min(item.product.quantity, 10) }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              disabled={busyItemId === item.id}
              onClick={() => removeItem(item.id)}
              className="text-xs text-ink/50 hover:text-rust uppercase tracking-widest"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div>
        <div className="border border-line p-6">
          <div className="flex items-center justify-between mb-6">
            <p className="label-eyebrow">Subtotal</p>
            <p className="text-xl">{formatPrice(subtotalCents, currency)}</p>
          </div>
          <label className="label-eyebrow text-ink/50 text-xs block mb-2" htmlFor="shippingAddress">
            Shipping Address
          </label>
          <textarea
            id="shippingAddress"
            value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)}
            rows={3}
            className="w-full border border-line p-3 text-sm mb-4 bg-paper"
            placeholder="Full name, address, city, state, PIN, phone"
          />
          <Button disabled={checkingOut || shippingAddress.trim().length < 10} onClick={checkout} className="w-full">
            {checkingOut ? "Redirecting to payment…" : "Proceed to Payment"}
          </Button>
          {error && <p className="text-xs text-rust mt-3">{error}</p>}
        </div>
      </div>
    </div>
  );
}
