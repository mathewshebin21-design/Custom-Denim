import { NextResponse } from "next/server";
import { requireSession, handleApiError } from "@/lib/auth/guards";
import { getOrCreateCart } from "@/lib/retail/service";

export async function GET() {
  try {
    const session = await requireSession();
    const cart = await getOrCreateCart(session.id);
    return NextResponse.json({ cart });
  } catch (err) {
    return handleApiError(err);
  }
}
