import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, handleApiError } from "@/lib/auth/guards";
import { assignArtist } from "@/lib/admin/service";

const Schema = z.object({ artistId: z.string().min(1) });

export async function POST(request: Request, ctx: RouteContext<"/api/admin/commissions/[id]/assign-artist">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const assignment = await assignArtist(id, parsed.data.artistId);
    return NextResponse.json({ assignment });
  } catch (err) {
    return handleApiError(err);
  }
}
