import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, handleApiError } from "@/lib/auth/guards";
import { reviseConcept } from "@/lib/studio/service";

const Schema = z.object({ feedback: z.string().min(3, "Tell us what you'd like to change.") });

export async function POST(request: Request, ctx: RouteContext<"/api/commissions/[id]/revise">) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const version = await reviseConcept(id, session.id, session.role, parsed.data.feedback);
    return NextResponse.json({ version });
  } catch (err) {
    return handleApiError(err);
  }
}
