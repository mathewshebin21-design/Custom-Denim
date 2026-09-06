import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, handleApiError, ApiError } from "@/lib/auth/guards";

const Schema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().max(2000).optional(),
});

export async function POST(request: Request, ctx: RouteContext<"/api/commissions/[id]/review">) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const commission = await db.commission.findUnique({ where: { id }, include: { review: true } });
    if (!commission) throw new ApiError(404, "Commission not found");
    if (commission.customerId !== session.id) throw new ApiError(403, "Not your commission");
    if (commission.status !== "completed") {
      throw new ApiError(400, "Reviews can only be left once a commission is completed");
    }
    if (commission.review) throw new ApiError(409, "You've already reviewed this commission");

    const review = await db.review.create({
      data: {
        commissionId: id,
        customerId: session.id,
        rating: parsed.data.rating,
        text: parsed.data.text,
      },
    });

    return NextResponse.json({ review });
  } catch (err) {
    return handleApiError(err);
  }
}
