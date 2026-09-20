import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, handleApiError } from "@/lib/auth/guards";
import { checkRateLimit } from "@/lib/rateLimit";
import { runAssistantTurn } from "@/lib/ai/adminAssistant";

const ChatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1) }))
    .min(1)
    .max(40),
});

const LIMIT = 30;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();

    // Keyed by admin user id, not IP — this is an authenticated, paid-API-call
    // endpoint, so the limit exists to bound cost/abuse per account rather
    // than to blunt anonymous brute-forcing (that's what the IP-keyed limits
    // on login/register/bootstrap are for).
    const rate = await checkRateLimit("admin-assistant", session.id, LIMIT, WINDOW_MS);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many assistant requests. Please wait a bit." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = ChatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const result = await runAssistantTurn(parsed.data.messages);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
