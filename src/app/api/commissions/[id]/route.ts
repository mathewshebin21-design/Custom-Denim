import { NextResponse } from "next/server";
import { requireSession, handleApiError } from "@/lib/auth/guards";
import { getCommissionDetail } from "@/lib/studio/service";

export async function GET(_request: Request, ctx: RouteContext<"/api/commissions/[id]">) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const commission = await getCommissionDetail(id, session.id, session.role);
    return NextResponse.json({ commission });
  } catch (err) {
    return handleApiError(err);
  }
}
