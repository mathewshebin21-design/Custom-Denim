import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, handleApiError } from "@/lib/auth/guards";
import { advanceStage } from "@/lib/admin/service";

const Schema = z.object({ stage: z.string().min(1), notes: z.string().optional() });

export async function POST(request: Request, ctx: RouteContext<"/api/admin/commissions/[id]/advance-stage">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const stage = await advanceStage(id, parsed.data.stage, parsed.data.notes);
    return NextResponse.json({ stage });
  } catch (err) {
    return handleApiError(err);
  }
}
