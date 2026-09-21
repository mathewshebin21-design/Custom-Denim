import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, handleApiError } from "@/lib/auth/guards";
import { createProduct, updateProduct, deleteProduct } from "@/lib/retail/service";
import { resolveProposal } from "@/lib/ai/assistantHistory";

// A product's own slug generation, mirroring AdminProductManager.tsx's
// client-side slugify (there's no shared util for this one-liner — same
// small, private-copy pattern already used elsewhere in this codebase, e.g.
// src/lib/admin/service.ts's own slugify).
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Mirrors CreateProductSchema/UpdateProductSchema in
// src/app/api/admin/products/[route.ts, [id]/route.ts] exactly. The AI
// assistant only ever *proposes* an action (src/lib/ai/adminAssistant.ts);
// this endpoint is what actually re-validates and applies it once the owner
// has confirmed, through the same rules as the manual admin UI — nothing
// the model produced is trusted without passing this schema.
const ActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_product"),
    title: z.string().min(1),
    category: z.string().min(1),
    brand: z.string().optional(),
    description: z.string().min(1),
    size: z.string().optional(),
    condition: z.enum(["new", "like_new", "good", "fair"]),
    source: z.enum(["surplus_branded", "thrifted_imported"]),
    priceCents: z.number().int().positive(),
    currency: z.string().min(1),
    quantity: z.number().int().min(0),
  }),
  z.object({
    type: z.literal("update_product"),
    id: z.string().min(1),
    title: z.string().min(1).optional(),
    priceCents: z.number().int().positive().optional(),
    currency: z.string().min(1).optional(),
    quantity: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("delete_product"),
    id: z.string().min(1),
  }),
]);

const RequestSchema = z.object({
  // Optional so this endpoint still works for an action that (for whatever
  // reason) was never persisted — the write itself doesn't depend on the
  // chat history row existing.
  messageId: z.string().min(1).optional(),
  action: ActionSchema,
});

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const { action, messageId } = parsed.data;

    try {
      const result = await applyAction(action);
      if (messageId) await resolveProposal(session.id, messageId, "confirmed");
      return NextResponse.json(result.body, { status: result.status });
    } catch (err) {
      if (messageId) {
        const message = err instanceof Error ? err.message : "Could not apply this change";
        await resolveProposal(session.id, messageId, "error", message);
      }
      throw err;
    }
  } catch (err) {
    return handleApiError(err);
  }
}

async function applyAction(
  action: z.infer<typeof ActionSchema>,
): Promise<{ body: Record<string, unknown>; status: number }> {
  if (action.type === "create_product") {
    const product = await createProduct({
      title: action.title,
      slug: slugify(action.title),
      category: action.category,
      brand: action.brand,
      description: action.description,
      size: action.size,
      condition: action.condition,
      source: action.source,
      priceCents: action.priceCents,
      currency: action.currency,
      quantity: action.quantity,
      imageUrls: [],
    });
    return { body: { product }, status: 201 };
  }

  if (action.type === "update_product") {
    const product = await updateProduct(action.id, {
      title: action.title,
      priceCents: action.priceCents,
      currency: action.currency,
      quantity: action.quantity,
      active: action.active,
    });
    return { body: { product }, status: 200 };
  }

  await deleteProduct(action.id);
  return { body: { ok: true }, status: 200 };
}
