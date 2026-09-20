import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, handleApiError } from "@/lib/auth/guards";
import { addProductImage } from "@/lib/retail/service";

const AddImageSchema = z.object({ url: z.string().min(1) });

export async function POST(request: Request, ctx: RouteContext<"/api/admin/products/[id]/images">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = AddImageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const image = await addProductImage(id, parsed.data.url);
    return NextResponse.json({ image }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
