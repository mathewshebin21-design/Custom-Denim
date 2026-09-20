import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/auth/guards";
import { getProductBySlug } from "@/lib/retail/service";

export async function GET(_request: Request, ctx: RouteContext<"/api/shop/products/[slug]">) {
  try {
    const { slug } = await ctx.params;
    const product = await getProductBySlug(slug);
    return NextResponse.json({ product });
  } catch (err) {
    return handleApiError(err);
  }
}
