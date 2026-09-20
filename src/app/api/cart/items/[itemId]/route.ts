import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, handleApiError } from "@/lib/auth/guards";
import { getOrCreateCart, setCartItemQuantity, removeCartItem } from "@/lib/retail/service";

const UpdateItemSchema = z.object({ quantity: z.number().int().min(0) });

/** Ownership is enforced by resolving the cart from the caller's own
 * session first, then checking the item belongs to it (see
 * setCartItemQuantity/removeCartItem in src/lib/retail/service.ts) — never
 * by trusting a cartId the client could pass. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/cart/items/[itemId]">) {
  try {
    const session = await requireSession();
    const { itemId } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = UpdateItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const cart = await getOrCreateCart(session.id);
    const updated = await setCartItemQuantity(cart.id, itemId, parsed.data.quantity);
    return NextResponse.json({ cart: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/cart/items/[itemId]">) {
  try {
    const session = await requireSession();
    const { itemId } = await ctx.params;
    const cart = await getOrCreateCart(session.id);
    const updated = await removeCartItem(cart.id, itemId);
    return NextResponse.json({ cart: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
