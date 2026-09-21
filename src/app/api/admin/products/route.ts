import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, handleApiError } from "@/lib/auth/guards";
import { listProductsForAdmin, createProduct } from "@/lib/retail/service";

export async function GET() {
  try {
    await requireAdmin();
    const products = await listProductsForAdmin();
    return NextResponse.json({ products });
  } catch (err) {
    return handleApiError(err);
  }
}

const CreateProductSchema = z.object({
  title: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase, hyphen-separated (e.g. jack-jones-jeans)."),
  category: z.string().min(1),
  brand: z.string().optional(),
  description: z.string().min(1),
  size: z.string().optional(),
  condition: z.enum(["new", "like_new", "good", "fair"]).default("good"),
  source: z.enum(["surplus_branded", "thrifted_imported"]),
  priceCents: z.number().int().positive(),
  compareAtPriceCents: z.number().int().positive().nullable().optional(),
  currency: z.string().default("inr"),
  quantity: z.number().int().min(0).default(1),
  imageUrls: z.array(z.string()).default([]),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = CreateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const product = await createProduct(parsed.data);
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
