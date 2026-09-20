import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, handleApiError } from "@/lib/auth/guards";
import { getOrCreateCart, addCartItem } from "@/lib/retail/service";

const AddItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json().catch(() => null);
    const parsed = AddItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const cart = await getOrCreateCart(session.id);
    const updated = await addCartItem(cart.id, parsed.data.productId, parsed.data.quantity);
    return NextResponse.json({ cart: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
