import { NextResponse } from "next/server";
import { requireAdmin, handleApiError } from "@/lib/auth/guards";
import { listRetailOrdersForAdmin } from "@/lib/retail/service";

export async function GET() {
  try {
    await requireAdmin();
    const orders = await listRetailOrdersForAdmin();
    return NextResponse.json({ orders });
  } catch (err) {
    return handleApiError(err);
  }
}
