import { NextResponse } from "next/server";
import { requireSession, handleApiError } from "@/lib/auth/guards";
import { createCheckoutForCommission } from "@/lib/studio/service";

/**
 * Creates a payment-provider checkout session for an approved commission's
 * already-locked order. The only inputs this route accepts from the client
 * are the commission id (from the URL) and the session cookie — amount,
 * currency, and eligibility are all re-derived server-side in
 * createCheckoutForCommission(), never taken from the request body.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/commissions/[id]/checkout">) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
    const result = await createCheckoutForCommission(id, session.id, appBaseUrl);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
