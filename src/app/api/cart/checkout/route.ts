import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, handleApiError } from "@/lib/auth/guards";
import { createCheckoutForCart } from "@/lib/retail/service";

const CheckoutSchema = z.object({ shippingAddress: z.string().min(10, "Enter a full shipping address.") });

/**
 * Starts a Stripe Checkout session for the caller's own cart. Mirrors
 * src/app/api/commissions/[id]/checkout/route.ts: the only inputs accepted
 * from the client are the session cookie and a shipping address — the cart
 * contents, prices, and stock are all re-derived server-side in
 * createCheckoutForCart(), never taken from the request body.
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json().catch(() => null);
    const parsed = CheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
    const result = await createCheckoutForCart(session.id, parsed.data.shippingAddress, appBaseUrl);
    return NextResponse.json({ checkoutUrl: result.checkout.checkoutUrl });
  } catch (err) {
    return handleApiError(err);
  }
}
