import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, handleApiError } from "@/lib/auth/guards";
import { setShipment } from "@/lib/admin/service";

const Schema = z.object({
  carrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  markShipped: z.boolean().optional(),
  markDelivered: z.boolean().optional(),
});

export async function POST(request: Request, ctx: RouteContext<"/api/admin/commissions/[id]/shipment">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const shipment = await setShipment(id, parsed.data);
    return NextResponse.json({ shipment });
  } catch (err) {
    return handleApiError(err);
  }
}
