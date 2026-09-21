import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, handleApiError } from "@/lib/auth/guards";
import { resolveProposal } from "@/lib/ai/assistantHistory";

// Only "cancelled" is settable here — "confirmed"/"error" are only ever set
// by the execute endpoint itself, as a side effect of actually applying (or
// failing to apply) the change, never by a bare client PATCH.
const PatchSchema = z.object({ status: z.literal("cancelled") });

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/assistant/messages/[id]">) {
  try {
    const session = await requireAdmin();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const message = await resolveProposal(session.id, id, parsed.data.status);
    return NextResponse.json({ message });
  } catch (err) {
    return handleApiError(err);
  }
}
