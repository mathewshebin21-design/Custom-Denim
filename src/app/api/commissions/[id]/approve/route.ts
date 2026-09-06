import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, handleApiError } from "@/lib/auth/guards";
import { approveVersion } from "@/lib/studio/service";

const Schema = z.object({ versionId: z.string().min(1) });

export async function POST(request: Request, ctx: RouteContext<"/api/commissions/[id]/approve">) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const artwork = await approveVersion(id, session.id, session.role, parsed.data.versionId);
    return NextResponse.json({ artwork });
  } catch (err) {
    return handleApiError(err);
  }
}
