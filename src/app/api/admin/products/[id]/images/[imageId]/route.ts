import { NextResponse } from "next/server";
import { requireAdmin, handleApiError } from "@/lib/auth/guards";
import { deleteProductImage } from "@/lib/retail/service";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/admin/products/[id]/images/[imageId]">) {
  try {
    await requireAdmin();
    const { id, imageId } = await ctx.params;
    await deleteProductImage(id, imageId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
