import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, handleApiError } from "@/lib/auth/guards";
import { addProductionUpdate } from "@/lib/admin/service";

const Schema = z.object({
  stage: z.string().min(1),
  message: z.string().min(1),
  photoUrl: z.string().optional(),
});

export async function POST(request: Request, ctx: RouteContext<"/api/admin/commissions/[id]/updates">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const update = await addProductionUpdate(id, parsed.data.stage, parsed.data.message, parsed.data.photoUrl);
    return NextResponse.json({ update });
  } catch (err) {
    return handleApiError(err);
  }
}
