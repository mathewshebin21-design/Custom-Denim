import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, handleApiError } from "@/lib/auth/guards";
import { createCommission } from "@/lib/studio/service";

const IntakeSchema = z.object({
  garmentId: z.string().min(1),
  storyText: z.string().min(20, "Tell us a bit more about your story (at least 20 characters)."),
  aestheticText: z.string().optional(),
  themes: z.array(z.string()).default([]),
  colors: z.array(z.string()).default([]),
  placement: z.string().optional(),
  occasion: z.string().optional(),
  budgetTierCents: z.number().int().positive().optional(),
  referenceImageUrls: z.array(z.string()).default([]),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json().catch(() => null);
    const parsed = IntakeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const commission = await createCommission(session.id, parsed.data);
    return NextResponse.json({ commission });
  } catch (err) {
    return handleApiError(err);
  }
}
