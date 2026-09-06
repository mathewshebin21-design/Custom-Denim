import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, handleApiError } from "@/lib/auth/guards";
import { setPaymentStatus } from "@/lib/admin/service";

const Schema = z.object({ status: z.enum(["pending", "succeeded", "failed", "refunded"]) });

export async function POST(request: Request, ctx: RouteContext<"/api/admin/commissions/[id]/payment">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const payment = await setPaymentStatus(id, parsed.data.status);
    return NextResponse.json({ payment });
  } catch (err) {
    return handleApiError(err);
  }
}
