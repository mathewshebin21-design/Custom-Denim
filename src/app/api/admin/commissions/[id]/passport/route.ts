import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, handleApiError } from "@/lib/auth/guards";
import { publishArtPassport } from "@/lib/admin/service";

const Schema = z.object({
  materials: z.string().optional(),
  finalDescription: z.string().optional(),
  careInstructions: z.string().optional(),
});

export async function POST(request: Request, ctx: RouteContext<"/api/admin/commissions/[id]/passport">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body ?? {});
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const passport = await publishArtPassport(id, parsed.data);
    return NextResponse.json({ passport });
  } catch (err) {
    return handleApiError(err);
  }
}
