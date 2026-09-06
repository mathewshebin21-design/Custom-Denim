import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, handleApiError } from "@/lib/auth/guards";
import { selectDirection } from "@/lib/studio/service";

const Schema = z.object({ creativeDirectionId: z.string().min(1) });

export async function POST(request: Request, ctx: RouteContext<"/api/commissions/[id]/select-direction">) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const version = await selectDirection(id, session.id, session.role, parsed.data.creativeDirectionId);
    return NextResponse.json({ version });
  } catch (err) {
    return handleApiError(err);
  }
}
