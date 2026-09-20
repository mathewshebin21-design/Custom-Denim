import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, handleApiError } from "@/lib/auth/guards";
import { updateProduct, deleteProduct } from "@/lib/retail/service";

const UpdateProductSchema = z.object({
  title: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  brand: z.string().optional(),
  description: z.string().min(1).optional(),
  size: z.string().optional(),
  condition: z.enum(["new", "like_new", "good", "fair"]).optional(),
  source: z.enum(["surplus_branded", "thrifted_imported"]).optional(),
  priceCents: z.number().int().positive().optional(),
  currency: z.string().min(1).optional(),
  quantity: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  videoUrl: z.string().min(1).optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/products/[id]">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = UpdateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const product = await updateProduct(id, parsed.data);
    return NextResponse.json({ product });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/admin/products/[id]">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    await deleteProduct(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
