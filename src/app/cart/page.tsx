import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/guards";
import { getOrCreateCart } from "@/lib/retail/service";
import { CartView } from "@/components/shop/CartView";

export const metadata: Metadata = { title: "Your Cart" };

export default async function CartPage() {
  const session = await requireSession();
  const cart = await getOrCreateCart(session.id);

  return (
    <div className="container-editorial py-24">
      <p className="label-eyebrow text-rust mb-4">Ease Wear / Shop</p>
      <h1 className="font-display text-4xl mb-12">Your cart.</h1>
      <CartView initialCart={cart} />
    </div>
  );
}
