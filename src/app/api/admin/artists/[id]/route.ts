import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, handleApiError } from "@/lib/auth/guards";
import { updateArtist, deleteArtist } from "@/lib/admin/service";

const UpdateArtistSchema = z.object({
  name: z.string().min(1).optional(),
  bio: z.string().optional(),
  photoUrl: z.string().min(1).optional(),
  styleTags: z.array(z.string()).optional(),
  capacityStatus: z.enum(["available", "limited", "full"]).optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/artists/[id]">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = UpdateArtistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const artist = await updateArtist(id, parsed.data);
    return NextResponse.json({ artist });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/admin/artists/[id]">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    await deleteArtist(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
