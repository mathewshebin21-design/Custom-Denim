import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, handleApiError } from "@/lib/auth/guards";
import { createProduct, updateProduct, deleteProduct, getProductForAdmin } from "@/lib/retail/service";
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
  z.object({
    type: z.literal("bulk_update_stock"),
    updates: z
      .array(z.object({ id: z.string().min(1), title: z.string(), quantity: z.number().int().min(0) }))
      .min(1)
      .max(50),
  }),
  z.object({
    type: z.literal("bulk_create_size_variants"),
    templateProductId: z.string().min(1),
    templateTitle: z.string().min(1),
    items: z
      .array(z.object({ size: z.string().min(1), quantity: z.number().int().min(0) }))
      .min(1)
      .max(50),
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

  if (action.type === "delete_product") {
    await deleteProduct(action.id);
    return { body: { ok: true }, status: 200 };
  }

  if (action.type === "bulk_update_stock") {
    // Each item is independent, so one bad id shouldn't sink the rest of a
    // shipment's worth of updates — every item is attempted and the
    // per-item outcome reported, rather than an all-or-nothing transaction
    // the owner would have to fully retry.
    const results = await Promise.allSettled(
      action.updates.map((u) => updateProduct(u.id, { quantity: u.quantity })),
    );
    const outcomes = results.map((r, i) => ({
      title: action.updates[i].title,
      ok: r.status === "fulfilled",
      error: r.status === "rejected" ? (r.reason instanceof Error ? r.reason.message : "Failed") : undefined,
    }));
    const failed = outcomes.filter((o) => !o.ok);
    if (failed.length > 0) {
      throw new Error(
        `${outcomes.length - failed.length}/${outcomes.length} updated. Failed: ${failed.map((f) => `${f.title} (${f.error})`).join(", ")}`,
      );
    }
    return { body: { outcomes }, status: 200 };
  }

  // bulk_create_size_variants: clones the template product's shared fields
  // (price, category, brand, description, condition, source, images,
  // video) into a new listing per size — only size and quantity differ.
  // Same independent-per-item reporting as bulk_update_stock, since one
  // size's slug colliding with an existing product shouldn't block the
  // rest.
  const template = await getProductForAdmin(action.templateProductId);
  if (!template) throw new Error(`Template product not found: ${action.templateTitle}`);
  const results = await Promise.allSettled(
    action.items.map((item) =>
      createProduct({
        title: template.title,
        slug: slugify(`${template.title} ${item.size}`),
        category: template.category,
        brand: template.brand ?? undefined,
        description: template.description,
        size: item.size,
        condition: template.condition,
        source: template.source,
        priceCents: template.priceCents,
        currency: template.currency,
        quantity: item.quantity,
        imageUrls: template.images.map((img) => img.url),
        videoUrl: template.videoUrl ?? undefined,
      }),
    ),
  );
  const outcomes = results.map((r, i) => ({
    size: action.items[i].size,
    ok: r.status === "fulfilled",
    error: r.status === "rejected" ? (r.reason instanceof Error ? r.reason.message : "Failed") : undefined,
  }));
  const failed = outcomes.filter((o) => !o.ok);
  if (failed.length > 0) {
    throw new Error(
      `${outcomes.length - failed.length}/${outcomes.length} created. Failed: ${failed.map((f) => `${f.size} (${f.error})`).join(", ")}`,
    );
  }
  return { body: { outcomes }, status: 201 };
}
